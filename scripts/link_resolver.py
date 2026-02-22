import urllib.parse

def resolve_mta_url(mta_code):
    """
    Generates a Google 'I'm Feeling Lucky' search query for the exact INSST PDF.
    This safely redirects the user's browser directly to the PDF file,
    bypassing server-side scraping blocks.
    """
    # Create an exact match query for the specific MTA code, restricted to PDFs on insst.es
    query = f'site:insst.es "{mta_code}" filetype:pdf'
    encoded_query = urllib.parse.quote(query)
    
    # btnI=I triggers Google's 'I am feeling lucky' auto-redirect
    return f"https://www.google.com/search?q={encoded_query}&btnI=I"

def resolve_apa_url(search_term):
    """
    Generates a Google 'I'm Feeling Lucky' search query for the APA YouTube video.
    """
    # Clean up the search term
    clean_term = search_term.split('(')[0].split('->')[0].strip()
    
    # We want to search for the specific Mutua Universal / APA video about measuring this specific agent/support.
    query = f'site:youtube.com "tutorial muestreo higiene industrial apa" "{clean_term}"'
    encoded_query = urllib.parse.quote(query)
    
    return f"https://www.google.com/search?q={encoded_query}&btnI=I"
