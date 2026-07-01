import sys
import re

def fix_mojibake(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        print(f'Failed to read {filepath} as utf-8')
        return
        
    replacements = {
        'â€¢': '•',
        'â€”': '—',
        'â€“': '–',
        'â€œ': '“',
        'â€ ': '”',
        'â€˜': '‘',
        'â€™': '’',
        'Â·': '·',
        'Â': '',
        'â€¦': '…',
        '?': '...',
        '': '·',
        'A': '·',
    }
    
    for bad, good in replacements.items():
        content = content.replace(bad, good)
        
    # Also fix some specific strings
    content = content.replace('Loading market data·?', 'Loading market data...')
    content = content.replace('Loading country borders·?', 'Loading country borders...')
    content = content.replace('A· Tickers:', '· Tickers:')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'Fixed encoding for {filepath}')

fix_mojibake('frontend/globe-gl/index.html')
