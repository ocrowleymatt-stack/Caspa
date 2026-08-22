import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import { coverConcepts, illustrationAssets, illustrationSlots, layoutSpecs, layoutVersions, productionExports, productionPreflights } from "../../drizzle/schema";
import type { LayoutPage } from "../../shared/layout";
import { splitManuscript } from "../../shared/manuscript";
import { assertActionAllowed } from "../../shared/workflow";
import { storageGetSignedUrl, storagePut } from "../storage";
import { createTraceId, logPrivateError } from "./errors";
import { requireConfiguredApprovals } from "./collaboration";
import { latestProductionRows, productionDb, requireOwnedLayout } from "./productionRepository";
import { requireOwnedProject, requireOwnedVersion } from "./repository";

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "book";
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function storedBuffer(key: string) {
  const url = await storageGetSignedUrl(key);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Stored production asset could not be loaded");
  return Buffer.from(await response.arrayBuffer());
}

function pdfBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

async function buildInteriorPdf(input: { project: Awaited<ReturnType<typeof requireOwnedProject>>; spec: typeof layoutSpecs.$inferSelect; pages: LayoutPage[]; illustrationBuffers: Map<string, Buffer> }) {
  const { project, spec, pages, illustrationBuffers } = input;
  const margins = JSON.parse(spec.marginsJson) as { top: number; right: number; bottom: number; left: number };
  const doc = new PDFDocument({ autoFirstPage: false, size: [spec.pageWidthPt, spec.pageHeightPt], margin: 0, info: { Title: project.title, Author: project.authorName, Creator: "CASPA Book Production" } });
  for (const page of pages) {
    doc.addPage({ size: [spec.pageWidthPt, spec.pageHeightPt], margin: 0 });
    const width = spec.pageWidthPt - margins.left - margins.right;
    const height = spec.pageHeightPt - margins.top - margins.bottom;
    doc.fillColor("#17140f");
    if (page.kind === "title") {
      doc.font("Times-Bold").fontSize(30).text(project.title, margins.left, spec.pageHeightPt * 0.28, { width, align: "center" });
      doc.moveDown(1.2).font("Times-Roman").fontSize(15).fillColor("#8c6c2f").text(project.authorName, { width, align: "center" });
    } else if (page.kind === "copyright") {
      doc.font("Times-Roman").fontSize(9).fillColor("#4a463e").text(page.text || "", margins.left, spec.pageHeightPt * 0.62, { width, align: "left" });
    } else if (page.kind === "chapter-opening") {
      doc.font("Times-Roman").fontSize(10).fillColor("#8c6c2f").text("CHAPTER", margins.left, spec.pageHeightPt * 0.25, { width, align: "center", characterSpacing: 2 });
      doc.moveDown(1.4).font("Times-Bold").fontSize(26).fillColor("#17140f").text(page.chapterTitle || "Untitled", { width, align: "center" });
    } else if (page.kind === "illustration" && page.imageUrl) {
      const image = illustrationBuffers.get(page.imageUrl);
      if (image) doc.image(image, margins.left, margins.top, { fit: [width, height - 24], align: "center", valign: "center" });
      if (page.caption) doc.font("Times-Italic").fontSize(8).fillColor("#4a463e").text(page.caption, margins.left, spec.pageHeightPt - margins.bottom + 4, { width, align: "center" });
    } else if (page.kind === "text") {
      if (spec.runningHeads) doc.font("Times-Roman").fontSize(7).fillColor("#716b60").text(page.chapterTitle || project.title, margins.left, Math.max(14, margins.top - 18), { width, align: page.number % 2 ? "right" : "left" });
      doc.font("Times-Roman").fontSize(spec.bodySizePt).fillColor("#17140f").text(page.text || "", margins.left, margins.top, { width, height, align: "justify", lineGap: spec.bodySizePt * (spec.lineHeightPct / 100 - 1), paragraphGap: spec.paragraphStyle === "spaced" ? spec.bodySizePt : 0, indent: spec.paragraphStyle === "indent" ? spec.bodySizePt * 1.5 : 0 });
    }
    if (spec.folios && page.number > 2 && page.kind !== "blank") doc.font("Times-Roman").fontSize(8).fillColor("#716b60").text(String(page.number), margins.left, spec.pageHeightPt - Math.max(18, margins.bottom - 12), { width, align: "center" });
  }
  return pdfBuffer(doc);
}

async function buildCoverPdf(input: { project: Awaited<ReturnType<typeof requireOwnedProject>>; spec: typeof layoutSpecs.$inferSelect; coverBuffer: Buffer }) {
  const { project, spec, coverBuffer } = input;
  const doc = new PDFDocument({ autoFirstPage: false, size: [spec.pageWidthPt, spec.pageHeightPt], margin: 0, info: { Title: `${project.title} — Cover`, Author: project.authorName, Creator: "CASPA Book Production" } });
  doc.addPage({ size: [spec.pageWidthPt, spec.pageHeightPt], margin: 0 });
  doc.image(coverBuffer, 0, 0, { cover: [spec.pageWidthPt, spec.pageHeightPt], align: "center", valign: "center" });
  doc.save().fillOpacity(0.72).fillColor("#090b10").rect(0, 0, spec.pageWidthPt, spec.pageHeightPt * 0.35).fill().rect(0, spec.pageHeightPt * 0.79, spec.pageWidthPt, spec.pageHeightPt * 0.21).fill().restore();
  doc.fillColor("#f1eadb").font("Times-Bold").fontSize(Math.max(28, Math.min(46, spec.pageWidthPt / 9))).text(project.title, spec.pageWidthPt * 0.09, spec.pageHeightPt * 0.09, { width: spec.pageWidthPt * 0.82, align: "center" });
  doc.fillColor("#c9a455").rect(spec.pageWidthPt * 0.38, spec.pageHeightPt * 0.285, spec.pageWidthPt * 0.24, 2).fill();
  doc.fillColor("#f1eadb").font("Times-Roman").fontSize(Math.max(12, spec.pageWidthPt / 30)).text(project.authorName, spec.pageWidthPt * 0.12, spec.pageHeightPt * 0.86, { width: spec.pageWidthPt * 0.76, align: "center", characterSpacing: 1.4 });
  return pdfBuffer(doc);
}

async function buildEpub(input: { project: Awaited<ReturnType<typeof requireOwnedProject>>; manuscript: Awaited<ReturnType<typeof requireOwnedVersion>>; cover: typeof coverConcepts.$inferSelect; coverBuffer: Buffer; slots: Array<typeof illustrationSlots.$inferSelect>; assets: Array<typeof illustrationAssets.$inferSelect>; assetBuffers: Map<number, Buffer> }) {
  const { project, manuscript, cover, coverBuffer, slots, assets, assetBuffers } = input;
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.folder("META-INF")!.file("container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  const oebps = zip.folder("OEBPS")!;
  oebps.file("styles.css", `body{font-family:Georgia,serif;line-height:1.55;margin:7%;color:#17140f}h1{font-weight:normal;text-align:center;margin:20vh 0 2rem}p{text-indent:1.4em;margin:0}.cover{margin:0;text-align:center}.cover img,.plate img{max-width:100%;max-height:95vh}.caption{font-style:italic;text-align:center;text-indent:0}`);
  const coverExt = cover.mimeType === "image/jpeg" ? "jpg" : cover.mimeType === "image/webp" ? "webp" : "png";
  oebps.file(`images/cover.${coverExt}`, coverBuffer);
  const manifestItems: string[] = [`<item id="css" href="styles.css" media-type="text/css"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="cover-image" href="images/cover.${coverExt}" media-type="${cover.mimeType}" properties="cover-image"/>`];
  const spineItems: string[] = [`<itemref idref="cover"/>`];
  const navItems: string[] = [];
  oebps.file("cover.xhtml", `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(project.title)}</title><link rel="stylesheet" href="styles.css"/></head><body class="cover"><img src="images/cover.${coverExt}" alt="Cover for ${escapeXml(project.title)}"/></body></html>`);
  const chapters = splitManuscript(manuscript.content);
  for (const chapter of chapters) {
    const id = `chapter-${chapter.index + 1}`;
    const plateMarkup: string[] = [];
    for (const slot of slots.filter(item => item.chapterIndex === chapter.index && item.status === "approved")) {
      const asset = assets.find(item => item.slotId === slot.id && item.status === "approved");
      if (!asset) continue;
      const buffer = assetBuffers.get(asset.id);
      if (!buffer) continue;
      const ext = asset.mimeType === "image/jpeg" ? "jpg" : asset.mimeType === "image/webp" ? "webp" : "png";
      const href = `images/illustration-${asset.id}.${ext}`;
      oebps.file(href, buffer);
      manifestItems.push(`<item id="image-${asset.id}" href="${href}" media-type="${asset.mimeType}"/>`);
      plateMarkup.push(`<figure class="plate"><img src="${href}" alt="${escapeXml(slot.altText)}"/>${slot.caption ? `<figcaption class="caption">${escapeXml(slot.caption)}</figcaption>` : ""}</figure>`);
    }
    const paragraphs = chapter.content.split(/\n\s*\n/).filter(Boolean).map(paragraph => `<p>${escapeXml(paragraph.trim())}</p>`).join("\n");
    oebps.file(`${id}.xhtml`, `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" href="styles.css"/></head><body><h1>${escapeXml(chapter.title)}</h1>${plateMarkup.join("\n")}${paragraphs}</body></html>`);
    manifestItems.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${id}"/>`);
    navItems.push(`<li><a href="${id}.xhtml">${escapeXml(chapter.title)}</a></li>`);
  }
  oebps.file("nav.xhtml", `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Contents</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><h1>Contents</h1><ol>${navItems.join("")}</ol></nav></body></html>`);
  oebps.file("content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">caspa-${project.id}-${manuscript.id}</dc:identifier><dc:title>${escapeXml(project.title)}</dc:title><dc:creator>${escapeXml(project.authorName)}</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest>${manifestItems.join("")}</manifest><spine>${spineItems.join("")}</spine></package>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

export async function generateProductionPackage(ownerId: number, projectId: number) {
  const project = await requireOwnedProject(ownerId, projectId);
  assertActionAllowed(project.currentState, "download-production");
  const db = await productionDb();
  const preflightRows = await db.select().from(productionPreflights).where(eq(productionPreflights.projectId, projectId)).orderBy(desc(productionPreflights.createdAt)).limit(1);
  const preflight = preflightRows[0];
  if (!preflight?.passed || !preflight.authorApproved) throw new Error("PRODUCTION_PREFLIGHT_REQUIRED");
  await requireConfiguredApprovals(ownerId, projectId, "production-export", "production-preflight", preflight.id);
  const layout = await requireOwnedLayout(ownerId, preflight.layoutVersionId);
  const latestLayouts = await db.select().from(layoutVersions).where(eq(layoutVersions.projectId, projectId)).orderBy(desc(layoutVersions.version)).limit(1);
  if (latestLayouts[0]?.id !== layout.id) throw new Error("LATEST_PROOF_PREFLIGHT_REQUIRED");
  if (layout.status !== "approved") throw new Error("PRODUCTION_PROOF_NOT_APPROVED");
  const specRows = await db.select().from(layoutSpecs).where(eq(layoutSpecs.id, layout.layoutSpecId)).limit(1);
  const spec = specRows[0];
  if (!spec) throw new Error("LAYOUT_SPEC_REQUIRED");
  const manuscript = await requireOwnedVersion(ownerId, layout.manuscriptVersionId);
  const rows = await latestProductionRows(ownerId, projectId);
  const cover = rows.covers.find(item => item.id === layout.coverConceptId && item.status === "approved");
  if (!cover) throw new Error("COVER_APPROVAL_REQUIRED");
  const traceId = createTraceId();
  try {
    const coverBuffer = await storedBuffer(cover.storageKey);
    const approvedAssets = rows.assets.filter(asset => asset.status === "approved" && asset.slotId);
    const assetBuffers = new Map<number, Buffer>();
    for (const asset of approvedAssets) assetBuffers.set(asset.id, await storedBuffer(asset.storageKey));
    const illustrationBuffers = new Map<string, Buffer>();
    for (const asset of approvedAssets) illustrationBuffers.set(asset.storageUrl, assetBuffers.get(asset.id)!);
    const pages = JSON.parse(layout.pagesJson) as LayoutPage[];
    const interiorPdf = await buildInteriorPdf({ project, spec, pages, illustrationBuffers });
    const coverPdf = await buildCoverPdf({ project, spec, coverBuffer });
    const epub = await buildEpub({ project, manuscript, cover, coverBuffer, slots: rows.slots, assets: approvedAssets, assetBuffers });
    const slug = safeSlug(project.title);
    const manifest = { projectId, title: project.title, author: project.authorName, manuscriptVersionId: manuscript.id, artBriefId: layout.artBriefId, coverConceptId: cover.id, layoutVersionId: layout.id, preflightId: preflight.id, trimSize: spec.trimSize, pageCount: layout.pageCount, generatedAt: new Date().toISOString(), files: { interiorPdf: `${slug}-interior.pdf`, coverPdf: `${slug}-cover.pdf`, epub: `${slug}.epub` }, checksums: { interiorPdf: sha256(interiorPdf), coverPdf: sha256(coverPdf), epub: sha256(epub) } };
    const bundle = new JSZip();
    bundle.file(manifest.files.interiorPdf, interiorPdf);
    bundle.file(manifest.files.coverPdf, coverPdf);
    bundle.file(manifest.files.epub, epub);
    bundle.file("manifest.json", JSON.stringify(manifest, null, 2));
    bundle.file(`assets/cover.${cover.mimeType === "image/jpeg" ? "jpg" : cover.mimeType === "image/webp" ? "webp" : "png"}`, coverBuffer);
    for (const asset of approvedAssets) bundle.file(`assets/illustration-${asset.id}.${asset.mimeType === "image/jpeg" ? "jpg" : asset.mimeType === "image/webp" ? "webp" : "png"}`, assetBuffers.get(asset.id)!);
    const packageBuffer = await bundle.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
    const artifacts = [
      { format: "interior-pdf" as const, filename: manifest.files.interiorPdf, mime: "application/pdf", buffer: interiorPdf },
      { format: "cover-pdf" as const, filename: manifest.files.coverPdf, mime: "application/pdf", buffer: coverPdf },
      { format: "epub" as const, filename: manifest.files.epub, mime: "application/epub+zip", buffer: epub },
      { format: "package" as const, filename: `${slug}-production-package.zip`, mime: "application/zip", buffer: packageBuffer },
    ];
    const created = [];
    for (const artifact of artifacts) {
      const stored = await storagePut(`production/${ownerId}/${projectId}/exports/${artifact.filename}`, artifact.buffer, artifact.mime);
      const result = await db.insert(productionExports).values({ projectId, layoutVersionId: layout.id, preflightId: preflight.id, format: artifact.format, storageKey: stored.key, storageUrl: stored.url, checksum: sha256(artifact.buffer), sizeBytes: artifact.buffer.length });
      created.push({ id: Number(result[0].insertId), format: artifact.format, filename: artifact.filename, url: stored.url, checksum: sha256(artifact.buffer), sizeBytes: artifact.buffer.length });
    }
    return { manifest, artifacts: created };
  } catch (error) {
    logPrivateError("production-output", traceId, error, { projectId, layoutVersionId: layout.id });
    throw error;
  }
}
