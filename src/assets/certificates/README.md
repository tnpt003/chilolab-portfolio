# Certificate images

Put the TOEIC certificate here as `toeic.jpg`, `toeic.png`, `toeic.jpeg` or `toeic.webp`.
The homepage "About me" section shows it automatically; with no file, nothing is shown.

Set the score and year in the CMS (Về mình / About → Điểm TOEIC, Năm thi TOEIC), or as `toeicScore` and `toeicYear` in both `src/content/profile/vi.yml` and `en.yml`.

Before adding the image (this repository and site are public):

- Blur or crop out the date of birth, ID/passport number, registration/serial number and any barcode or QR code.
- Decide whether to keep the portrait; cropping it out is the safer default.
- Strip photo metadata (re-export or screenshot the edited image).

Do not add the Athena course PDFs here: they carry the date of birth, portrait and QR code. The course names, provider and dates are listed in `src/content/profile/<locale>.yml`.
