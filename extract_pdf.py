from pypdf import PdfReader
import sys
import os

pdf_path = r"C:\Users\wiseman\Desktop\CBT exam Gemini\CDCFIB PRACTICE QUESTIONS@FJ_OBA(TIKTOK).pdf"
out_path = os.path.join(os.path.dirname(pdf_path), 'cdcfib_extracted.txt')

try:
    reader = PdfReader(pdf_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text()
            f.write(f"\n\n--- PAGE {i} ---\n\n")
            if text:
                f.write(text)
            else:
                f.write('[NO TEXT EXTRACTED FROM THIS PAGE]\n')
    print(f"Extraction complete. Output: {out_path}")
except Exception as e:
    print('Error extracting PDF:', e)
    sys.exit(1)
