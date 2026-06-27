# CASPA Journey-Level UX Critique

**Baseline:** `7bd7932` · First-time paying user lens

| Journey | Current click path | Decisions | Main confusion | Output risk | Simplification | Priority |
| --------- | ------------------ | --------- | -------------- | ----------- | -------------- | -------- |
| 1. Start from nothing | Today → Projects → New → Overview → Casper/Bible | 4–6 | Which first: wizard, bible, or NWP? | Low if bible used | One card: “Start with material” → project + wizard | P1 |
| 2. Upload messy notes | Project → Sources tab → paste/upload → classify | 3–4 | Classify buttons unclear value | Low | Guide Me after upload | P2 |
| 3. Upload manuscript | Projects → import OR Casper upload OR manuscript tab | 3+ | Three import paths | Medium if wrong path | Single “Add material” on Overview → Sources | P1 |
| 4. Receipt / odd artifact | Sources → upload → classify as seed/research | 2–3 | “Is this allowed?” | Low | Empty state copy: “receipts become props/clues” | P2 |
| 5. Choose product type | `/start` wizard OR buried | 2 | Wizard not linked from new project | Medium without brief | Prompt wizard after first assets | P1 |
| 6. Production Brief | `/start` step 3 OR API only | 3–5 | Separate from bible | Medium | Merge mentally as “Plan step 1” | P1 |
| 7. Project Bible | Project → Bible tab OR Overview button | 2 | vs Book Map order | High if skipped | Plan strip: Brief → Bible → Map | P1 |
| 8. Book Map | Book Map tab OR Overview | 2 | When to generate | Medium | After bible in Plan strip | P2 |
| 9. Guide Me | Top bar → drawer | 1 | Needs active project | Low | Default on Overview too | P2 |
| 10. First serious draft | Casper NWP OR Overview Auto-write | 2–3 | Casper vs manuscript | High if no bible | Write tab + brief check | P1 |
| 11. Continue chapter | Chapter editor OR Overview OR outputs | 3 | Where to continue | Low | One “Continue writing” on Overview | P2 |
| 12. Write next missing | Book Map → chapter rail → draft | 3–4 | Hidden on mobile without rail button | Medium | Book Map CTA + Guide Me | P2 |
| 13. Rescue bad material | Trash to Treasure (Today or project) | 2 | Named “Trash” | Low | Keep; surface on Today secondary | P2 |
| 14. Improve output | Output detail OR Gold tab OR Swarm | 3+ | Gold vs Swarm vs Awards | Low | Improve tab consolidates | P2 |
| 15. Gold Pass | Project Improve tab | 2 | Long wait without progress | Low | Staged progress (done) | P3 |
| 16. Saved Writing | Outputs global or project tab | 1–2 | “Where did my draft go?” | Low | Stronger post-run links | P2 |
| 17. Apply safely | Output detail → apply + confirm + snapshot | 3 | Fear of overwrite | **High if broken** | Keep snapshot flow visible | P0 guard |
| 18. Export MD/DOCX | Project Export tab | 2 | PDF vs DOCX | Low | Export tab label clarity | P2 |
| 19. AI failure | Provider status / toast | 1–2 | Ollama slow | Low | Copy on progress panels (done) | P3 |
| 20. Phone/tablet | Bottom nav + menu drawer | 2–3 | Long menu in Producer mode | Low | Simple mode default; scroll hint (done) | P2 |
| 21. Intimacy settings | Wizard step 3 only | 2–4 | Not editable later obvious | Medium | Link from Plan/Settings | P2 |

**P0:** None open at baseline (apply/snapshot/auth verified).  
**P1 focus:** unified material → plan → write path, reduce import/plan fragmentation.
