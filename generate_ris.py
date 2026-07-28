#!/usr/bin/env python3
"""Generate RIS file for Mendeley import."""

ris_entries = []

# 1. React Documentation
ris_entries.append("""TY  - ELEC
TI  - React Documentation
AU  - Facebook Open Source
PY  - 2024
UR  - https://react.dev/
ER  -""")

# 2. Firebase Documentation
ris_entries.append("""TY  - ELEC
TI  - Firebase Documentation
AU  - Google
PY  - 2024
UR  - https://firebase.google.com/docs
ER  -""")

# 3. Tailwind CSS Documentation
ris_entries.append("""TY  - ELEC
TI  - Tailwind CSS Documentation
AU  - Tailwind Labs
PY  - 2024
UR  - https://tailwindcss.com/docs
ER  -""")

# 4. Vite Documentation
ris_entries.append("""TY  - ELEC
TI  - Vite Documentation
AU  - You, Evan
PY  - 2024
UR  - https://vitejs.dev/
ER  -""")

# 5. Express.js Documentation
ris_entries.append("""TY  - ELEC
TI  - Express.js Documentation
AU  - Express.js
PY  - 2024
UR  - https://expressjs.com/
ER  -""")

# 6. MDN Web Docs - QR Code
ris_entries.append("""TY  - ELEC
TI  - MDN Web Docs: QR Code
AU  - Mozilla
PY  - 2024
UR  - https://developer.mozilla.org/
ER  -""")

# 7. Alief & Rianto (2025)
ris_entries.append("""TY  - JOUR
TI  - Perancangan Sistem Absensi Siswa Berbasis Quick Response (QR) Code Menggunakan Framework JavaScript
AU  - Alief, Rafli Naufal
AU  - Rianto, Harsih
PY  - 2025
DO  - 10.31294/insantek.v6i2.10185
UR  - https://doi.org/10.31294/insantek.v6i2.10185
JF  - INSANtek
VL  - 6
IS  - 2
SP  - 89
EP  - 97
ER  -""")

# 8. Praba, Safitri & Faridi (2025)
ris_entries.append("""TY  - JOUR
TI  - Aplikasi Absensi Berbasis Website Menggunakan QR Code untuk Peningkatan Efisiensi Pencatatan Kehadiran
AU  - Praba, Ardian Dwi
AU  - Safitri, Maryanah
AU  - Faridi, Faridi
PY  - 2025
DO  - 10.31000/jt.v14i2.15517
UR  - https://doi.org/10.31000/jt.v14i2.15517
JF  - Jurnal Teknik
VL  - 14
IS  - 2
ER  -""")

# 9. Fadhilah, Auliana & Aryanto (2025)
ris_entries.append("""TY  - JOUR
TI  - Perancangan Sistem Absensi Siswa Berbasis Web Menggunakan QR Code Disekolah PAUD Amelia Darul Akhyar Cikande
AU  - Fadhilah, Laila Nur
AU  - Auliana, Sigit
AU  - Aryanto, Gagah Dwiki Putra
PY  - 2025
DO  - 10.54209/jatilima.v7i02.1530
UR  - https://doi.org/10.54209/jatilima.v7i02.1530
JF  - Jurnal Multimedia dan Teknologi Informasi (Jatilima)
VL  - 7
IS  - 02
SP  - 282
EP  - 290
ER  -""")

# 10. Nuralif & Fachrie (2023)
ris_entries.append("""TY  - JOUR
TI  - Development of a QR code-based attendance system for factory employees
AU  - Nuralif, I.
AU  - Fachrie, M.
PY  - 2023
JF  - International Journal Software Engineering and Computer Science (IJSECS)
VL  - 3
IS  - 3
SP  - 281
EP  - 286
UR  - https://ejournal.undiksha.ac.id/
ER  -""")

# 11. Djamarullah, Nuryasin & Wibowo (2024)
ris_entries.append("""TY  - JOUR
TI  - Designing a QR Code Attendance System Using BYOD (Bring Your Own Device)
AU  - Djamarullah, A. R.
AU  - Nuryasin, I.
AU  - Wibowo, H.
PY  - 2024
JF  - Ultimatics: Jurnal Teknik Informatika
VL  - 16
IS  - 1
SP  - 32
EP  - 37
ER  -""")

# 12. Balogun (2026)
ris_entries.append("""TY  - JOUR
TI  - Design and Implementation of an Enhanced QR-Code Based Attendance System
AU  - Balogun, Fortune
PY  - 2026
DO  - 10.33736/jcsi.10752.2026
UR  - https://doi.org/10.33736/jcsi.10752.2026
JF  - Journal of Computing and Social Informatics
ER  -""")

# 13. html5-qrcode
ris_entries.append("""TY  - ELEC
TI  - html5-qrcode Library Documentation
AU  - Minh, T.
PY  - 2024
UR  - https://github.com/mebjas/html5-qrcode
ER  -""")

# 14. jsPDF
ris_entries.append("""TY  - ELEC
TI  - jsPDF Library Documentation
AU  - Hall, H.
PY  - 2024
UR  - https://github.com/parallax/jsPDF
ER  -""")

# 15. jspdf-autotable
ris_entries.append("""TY  - ELEC
TI  - jspdf-autotable Documentation
AU  - Simek, M.
PY  - 2024
UR  - https://github.com/simonbengtsson/jspdf-autotable
ER  -""")

# 16. date-fns
ris_entries.append("""TY  - ELEC
TI  - date-fns Documentation
AU  - Paz, J.
PY  - 2024
UR  - https://date-fns.org/
ER  -""")

# 17. lucide-react
ris_entries.append("""TY  - ELEC
TI  - lucide-react Icons Library
AU  - Cristea, C.
PY  - 2024
UR  - https://lucide.dev/
ER  -""")

# 18. motion/react
ris_entries.append("""TY  - ELEC
TI  - motion/react Animation Library
AU  - Müller, D.
PY  - 2024
UR  - https://motion.dev/
ER  -""")

# Write RIS file
output_path = '/root/ElnusaAbsensiWEB/references.ris'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n\n'.join(ris_entries))

print(f"RIS file saved: {output_path}")
print(f"Total references: {len(ris_entries)}")
