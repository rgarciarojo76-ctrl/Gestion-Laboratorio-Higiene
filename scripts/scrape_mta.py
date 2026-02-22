import urllib.request
import re
import sys
import json

def get_mta_url(mta_code):
    search_url = f"https://www.insst.es/buscador-general?q={urllib.parse.quote(mta_code)}"
    req = urllib.request.Request(
        search_url,
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    try:
        with urllib.request.urlopen(req) as res:
            html = res.read().decode('utf-8')
            # INSST search results usually link to the document viewer, then the PDF
            # We look for ahrefs that contain the mta pattern or document GUID
            links = re.findall(r'href=[\'"](https://www.insst.es/documents/94886/[^\'"]+)[\'"]', html)
            if links:
                # Prioritize pdf extensions
                pdf_links = [l for l in set(links) if '.pdf' in l.lower()]
                return pdf_links[0] if pdf_links else links[0]
            
            # Alternative: look for entry path
            alt_links = re.findall(r'href=[\'"]([^\'"]+mta-ma[^\'"]+)[\'"]', html)
            if alt_links:
                href = alt_links[0]
                if not href.startswith("http"): href = "https://www.insst.es" + href
                return href
    except Exception as e:
        return None
    return search_url # Fallback to search

if __name__ == "__main__":
    if len(sys.argv) > 1:
        import urllib.parse
        print(get_mta_url(sys.argv[1]))
