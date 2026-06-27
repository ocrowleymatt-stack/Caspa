# Manual Market Leader Test Script

Browser-level checklist for CASPA market-leader acceptance. Run on https://caspa.ocrowley.com after deploy.

**Tester:** _______________ **Date:** _______________ **Commit:** _______________

## 1. Login & Today

- [ ] Open `/login` — form loads, submit works
- [ ] Land on `/home` — "What are we making today?" visible
- [ ] Secret Weapon cockpit shows Continue / Rescue / Finish / Exports cards
- [ ] Provider status shows at least one engine or clear Ollama message
- [ ] Trash to Treasure link goes to `/casper/trash-to-treasure` (not generic Casper)

## 2. Blank project

- [ ] Projects → create blank project
- [ ] Project overview shows Book Map, Finish This Book, Saved Writing links

## 3. Multi-chapter import

- [ ] Structure tab or import wizard — paste 4-chapter fixture
- [ ] Structure report saved to Outputs
- [ ] Book Map generate shows **staged progress** (not frozen spinner only)

## 4. Trash to Treasure

- [ ] Paste messy material → problem → outcome → Rescue
- [ ] Staged progress visible during run
- [ ] Completion shows diagnosis, plan, sample, **Open Saved Writing**
- [ ] Original not overwritten (verify source chapter unchanged)

## 5. Chapter rail

- [ ] Open chapter editor — rail lists chapters + missing from Book Map
- [ ] Prev/Next navigation works
- [ ] Continue writing shows staged progress
- [ ] Draft missing chapter creates new chapter + output

## 6. Swarm & Gold

- [ ] Project Swarm — run critique — staged progress + saved output link
- [ ] Gold Pass — run — progress visible (stream or stages)
- [ ] Output appears in Saved Writing with correct kind filter

## 7. Saved Writing archive

- [ ] Filters: Drafts, Book maps, Trash to Treasure, Gold, Swarm
- [ ] Card shows kind, project, date, word count, provider
- [ ] Open → Continue / Gold / Apply (with confirm + snapshot)

## 8. Export

- [ ] Project Export — Copy Markdown works
- [ ] Download DOCX — file opens in Word without JSON/debug junk
- [ ] Full archive ZIP creates output

## 9. Security smoke

- [ ] Log out — `/api/projects` returns 401
- [ ] `/health` and `/api/doctor` public without secrets

## 10. Failure clarity

- [ ] If cloud quota fails, UI mentions fallback to Ollama (not vague "No AI")

**Pass criteria:** All checked except PDF polish (optional). No P0 data-loss or missing output.
