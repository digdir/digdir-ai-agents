#!/usr/bin/env python3
"""
PII Pattern Checker
Usage: python pii-check.py [--root-folder path] [--config-file config.txt] [--warn-only]
"""

import argparse
import re
import os
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from fnmatch import fnmatch

# Define regex patterns for PII detection
PATTERNS = {
    'phone': [
        # International format +XX... (1-3 digit country code + 7-12 digit number)
        r'\+\d{1,3}\s*(?:\d\s*){7,12}\d',             # +XX XXXX XXXX... (flexible spacing)
        r'\+\d{1,3}\d{7,12}',                         # +XXXXXXXXX... (country code + 7-12 digits)
        
        # International format 00XX... (same as + but with 00 prefix)
        r'00\d{1,3}\s*(?:\d\s*){7,12}\d',             # 00XX XXXX XXXX... (flexible spacing)
        r'00\d{1,3}\d{7,12}',                          # 00XXXXXXXXX... (country code + 7-12 digits)
        
        # Norwegian 8-digit numbers (domestic format)
        r'\b\d{2}\s*\d{2}\s*\d{2}\s*\d{2}\b',         # XX XX XX XX (8 digits with spaces)
        r'\b\d{8}\b'                                  # XXXXXXXX (8 digits, no spaces)
    ],
    'org': [
        r'\b\d{3}\s*\d{3}\s*\d{3}\b',                 # XXX XXX XXX (9 digits with spaces)
        r'\b\d{9}\b'                                  # XXXXXXXXX (9 digits, no spaces)
    ],
    'fnr': [
        r'\b\d{6}\s*\d{5}\b',                         # XXXXXX XXXXX (11 digits with spaces)
        r'\b\d{11}\b'                                 # XXXXXXXXXXX (11 digits, no spaces)
    ],
    'email': [
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'  # Standard email pattern
    ]
}

# File extensions to scan
SCAN_EXTENSIONS = {'.md', '.txt', '.json', '.xml', '.cs', '.js', '.ts', '.py', '.java', '.go', '.cpp', '.c', '.h'}

class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    
    @staticmethod
    def green(text: str) -> str:
        return f"{Colors.GREEN}{text}{Colors.RESET}"
    
    @staticmethod
    def yellow(text: str) -> str:
        return f"{Colors.YELLOW}{text}{Colors.RESET}"
    
    @staticmethod
    def cyan(text: str) -> str:
        return f"{Colors.CYAN}{text}{Colors.RESET}"

def load_permitted_values(config_path: str) -> Tuple[Dict[str, Set[str]], List[str]]:
    """Load permitted values and ignore patterns from config file"""
    permitted = {
        'phone': set(),
        'org': set(),
        'fnr': set(),
        'email': set()
    }
    ignore_patterns = []
    
    if not os.path.exists(config_path):
        print(Colors.yellow(f"Config file not found: {config_path}"))
        return permitted, ignore_patterns
    
    current_type = None
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('#') and len(line) > 1:
                    # Extract type from #phone, #org, #fnr, #ignore-files
                    current_type = line[1:].lower()
                elif line and not line.startswith('#') and current_type:
                    if current_type == 'ignore-files':
                        # Add ignore pattern
                        ignore_patterns.append(line)
                    elif current_type in permitted:
                        # For email addresses, preserve original format (don't remove spaces)
                        if current_type == 'email':
                            permitted[current_type].add(line.strip())
                        else:
                            # Normalize the value (remove spaces)
                            normalized_value = re.sub(r'\s+', '', line)
                            permitted[current_type].add(normalized_value)
                            
                            # For phone numbers, automatically generate international variants
                            if current_type == 'phone':
                                # For 8-digit Norwegian numbers, generate +47 and 0047 variants
                                if len(normalized_value) == 8 and normalized_value.isdigit():
                                    permitted[current_type].add(f'+47{normalized_value}')
                                    permitted[current_type].add(f'0047{normalized_value}')
                                
                                # For international numbers, generate both + and 00 variants
                                elif normalized_value.startswith('+'):
                                    permitted[current_type].add('00' + normalized_value[1:])
                                elif normalized_value.startswith('00') and len(normalized_value) > 2:
                                    permitted[current_type].add('+' + normalized_value[2:])
    except Exception as e:
        print(Colors.yellow(f"Error reading config file: {e}"))
    
    return permitted, ignore_patterns

def normalize_value(value: str, pii_type: str) -> List[str]:
    """Normalize detected values (remove spaces, standardize format)"""
    # For email addresses, preserve original format
    if pii_type == 'email':
        return [value.strip()]
    
    normalized = re.sub(r'\s+', '', value)
    
    # For phone numbers, handle international format conversions
    if pii_type == 'phone':
        variants = [normalized]
        
        # Convert +XX to 00XX format
        if normalized.startswith('+'):
            variants.append('00' + normalized[1:])
        
        # Convert 00XX to +XX format  
        elif normalized.startswith('00') and len(normalized) > 2:
            variants.append('+' + normalized[2:])
        
        return variants
    
    return [normalized]

def is_permitted_value(value: str, pii_type: str, permitted_values: Dict[str, Set[str]]) -> bool:
    """Check if a value is in the permitted list"""
    normalized_values = normalize_value(value, pii_type)
    
    for normalized_value in normalized_values:
        if normalized_value in permitted_values.get(pii_type, set()):
            return True
    
    return False

def scan_file(file_path: Path, permitted_values: Dict[str, Set[str]], root_path: Path) -> List[Tuple[str, str, str, int]]:
    """Scan a single file for PII patterns. Returns list of (type, value, relative_path, line_number)"""
    findings = []
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception as e:
        print(Colors.yellow(f"Error reading file {file_path}: {e}"))
        return findings
    
    relative_path = str(file_path.relative_to(root_path))
    
    for line_num, line in enumerate(lines, 1):
        # Track positions already matched to avoid overlaps
        matched_positions = set()
        
        for pii_type, patterns in PATTERNS.items():
            for pattern in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    start, end = match.span()
                    # Check if this position overlaps with existing matches
                    if not any(pos in range(start, end) for pos in matched_positions):
                        value = match.group()
                        findings.append((pii_type, value, relative_path, line_num))
                        # Mark these positions as matched
                        matched_positions.update(range(start, end))
    
    return findings

def should_ignore_file(file_path: Path, root_path: Path, ignore_patterns: List[str]) -> bool:
    """Check if a file should be ignored based on patterns"""
    if not ignore_patterns:
        return False
    
    # Get relative path for pattern matching
    try:
        relative_path = file_path.relative_to(root_path)
        relative_str = str(relative_path).replace('\\', '/')  # Normalize path separators
        
        for pattern in ignore_patterns:
            # Check if pattern matches the file path
            if fnmatch(relative_str, pattern):
                return True
            
            # Also check just the filename
            if fnmatch(file_path.name, pattern):
                return True
                
            # Handle ** patterns for deep directory matching
            if '**' in pattern:
                # Convert ** pattern to regex-like matching
                pattern_parts = pattern.split('**')
                if len(pattern_parts) == 2:
                    start_pattern = pattern_parts[0].rstrip('/')
                    end_pattern = pattern_parts[1].lstrip('/')
                    
                    if start_pattern and not relative_str.startswith(start_pattern):
                        continue
                    if end_pattern and not fnmatch(relative_str.split('/')[-1], end_pattern):
                        continue
                    return True
        
        return False
    except ValueError:
        # File is not under root_path
        return False

def scan_files(root_folder: str, permitted_values: Dict[str, Set[str]], ignore_patterns: List[str]) -> List[Tuple[str, str, str, int]]:
    """Main scanning function"""
    root_path = Path(root_folder)
    
    if not root_path.exists():
        print(f"Error: Root folder not found: {root_folder}")
        sys.exit(1)
    
    # Find all files to scan
    files_to_scan = []
    ignored_count = 0
    
    for file_path in root_path.rglob('*'):
        if file_path.is_file() and file_path.suffix.lower() in SCAN_EXTENSIONS:
            if should_ignore_file(file_path, root_path, ignore_patterns):
                ignored_count += 1
            else:
                files_to_scan.append(file_path)
    
    print(f"Scanning {len(files_to_scan)} files (ignored {ignored_count} files)...")
    
    # Collect all findings
    all_findings = []
    for file_path in files_to_scan:
        findings = scan_file(file_path, permitted_values, root_path)
        all_findings.extend(findings)
    
    return all_findings

def main():
    parser = argparse.ArgumentParser(description='PII Pattern Checker')
    parser.add_argument('--root-folder', default='.', help='Root folder to scan (default: current directory)')
    parser.add_argument('--config-file', default='permitted-data.config', help='Config file with permitted values')
    parser.add_argument('--warn-only', action='store_true', help='Only show warnings, hide OK messages')
    
    args = parser.parse_args()
    
    print(Colors.cyan("PII Pattern Checker"))
    print(Colors.cyan("=================="))
    print(f"Root folder: {args.root_folder}")
    print(f"Config file: {args.config_file}")
    print(f"Warn only: {args.warn_only}")
    print()
    
    # Load permitted values and ignore patterns
    permitted_values, ignore_patterns = load_permitted_values(args.config_file)
    
    print(Colors.cyan("Loaded permitted values:"))
    for pii_type, values in permitted_values.items():
        print(f"  {pii_type}: {len(values)} values")
    print(f"Ignore patterns: {len(ignore_patterns)} patterns")
    if ignore_patterns:
        for pattern in ignore_patterns:
            print(f"  - {pattern}")
    print()
    
    # Scan files
    findings = scan_files(args.root_folder, permitted_values, ignore_patterns)
    
    # Process and display findings
    warn_count = 0
    ok_count = 0
    
    for pii_type, value, relative_path, line_num in findings:
        is_permitted = is_permitted_value(value, pii_type, permitted_values)
        
        if is_permitted:
            ok_count += 1
            if not args.warn_only:
                print(Colors.green(f"OK: Accepted PII <{pii_type}:{value}> in <{relative_path}:{line_num}>"))
        else:
            warn_count += 1
            print(Colors.yellow(f"WARN: Possible PII found <{pii_type}:{value}> in <{relative_path}:{line_num}>"))
    
    print()
    print(Colors.cyan("Scan completed."))
    print(f"Warnings: {warn_count}, OK: {ok_count}")

if __name__ == '__main__':
    main()