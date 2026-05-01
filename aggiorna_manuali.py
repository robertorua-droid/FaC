import os
import glob

def sync_manuals():
    docs_dir = "DOCUMENTAZIONE"
    output_file = os.path.join("js", "features", "navigation", "docs-content.js")
    
    if not os.path.exists(docs_dir):
        print(f"ERRORE: Cartella '{docs_dir}' non trovata!")
        return

    js_lines = [
        "(function () {",
        "  window.AppDocumentationContent = {"
    ]

    md_files = glob.glob(os.path.join(docs_dir, "*.md"))
    
    for i, file_path in enumerate(md_files):
        key = os.path.splitext(os.path.basename(file_path))[0]
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Usiamo repr() per ottenere una stringa JS valida (escapa newline, apici, ecc.)
            safe_content = repr(content)
            
            line = f'    "{key}": {safe_content},'
            js_lines.append(line)
            
            if i < len(md_files) - 1:
                js_lines.append("")
                
        except Exception as e:
            print(f"Errore nella lettura del file {file_path}: {e}")

    js_lines.append("  };")
    js_lines.append("})();")

    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    try:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(js_lines))
        print(f"Successo! Aggiornato {output_file}")
    except Exception as e:
        print(f"Errore nella scrittura: {e}")

if __name__ == "__main__":
    sync_manuals()
