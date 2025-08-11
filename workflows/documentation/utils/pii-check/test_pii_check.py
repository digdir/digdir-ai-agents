#!/usr/bin/env python3
"""
Unit tests for PII checker functionality
Run with: python -m pytest test_pii_check.py -v
or: python test_pii_check.py
"""

import unittest
import tempfile
import os
from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("pii_check", "./pii-check.py")
pii_check_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pii_check_module)

load_permitted_values = pii_check_module.load_permitted_values
normalize_value = pii_check_module.normalize_value
is_permitted_value = pii_check_module.is_permitted_value
scan_file = pii_check_module.scan_file
should_ignore_file = pii_check_module.should_ignore_file
PATTERNS = pii_check_module.PATTERNS
import re

class TestPIIChecker(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.test_config_content = """# Test config
#phone
99999999
12345678

#org  
111222333
987654321

#fnr
90909011223
12345678901

#email
example@test.no
test@example.com

#ignore-files
*.test.cs
*Test*.cs
test/*
**/test/**
node_modules/*
"""
        
    def tearDown(self):
        """Clean up test fixtures"""
        # Clean up temp directory
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def create_temp_config(self, content: str) -> str:
        """Create a temporary config file"""
        config_path = os.path.join(self.temp_dir, 'test_config.txt')
        with open(config_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return config_path
    
    def create_temp_file(self, filename: str, content: str) -> Path:
        """Create a temporary test file"""
        file_path = Path(self.temp_dir) / filename
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return file_path

    def test_load_permitted_values_basic(self):
        """Test loading basic permitted values"""
        config_path = self.create_temp_config(self.test_config_content)
        permitted, ignore_patterns = load_permitted_values(config_path)
        
        # Check phone numbers (should include auto-generated variants)
        self.assertIn('99999999', permitted['phone'])
        self.assertIn('+4799999999', permitted['phone'])  # Auto-generated for 8-digit numbers
        self.assertIn('004799999999', permitted['phone'])  # Auto-generated
        self.assertIn('12345678', permitted['phone'])
        self.assertIn('+4712345678', permitted['phone'])
        
        # Check org numbers
        self.assertIn('111222333', permitted['org'])
        self.assertIn('987654321', permitted['org'])
        
        # Check FNR
        self.assertIn('90909011223', permitted['fnr'])
        self.assertIn('12345678901', permitted['fnr'])
        
        # Check email
        self.assertIn('example@test.no', permitted['email'])
        self.assertIn('test@example.com', permitted['email'])
        
        # Check ignore patterns
        self.assertIn('*.test.cs', ignore_patterns)
        self.assertIn('*Test*.cs', ignore_patterns)
        self.assertIn('test/*', ignore_patterns)
        self.assertIn('**/test/**', ignore_patterns)
        self.assertIn('node_modules/*', ignore_patterns)
    
    def test_load_permitted_values_missing_file(self):
        """Test handling of missing config file"""
        permitted, ignore_patterns = load_permitted_values('nonexistent_file.txt')
        self.assertEqual(len(permitted['phone']), 0)
        self.assertEqual(len(permitted['org']), 0)
        self.assertEqual(len(permitted['fnr']), 0)
        self.assertEqual(len(permitted['email']), 0)
        self.assertEqual(len(ignore_patterns), 0)
    
    def test_normalize_value_phone(self):
        """Test phone number normalization"""
        # Basic normalization (remove spaces)
        self.assertEqual(normalize_value('99 99 99 99', 'phone'), ['99999999'])
        self.assertEqual(normalize_value('123 456 78', 'phone'), ['12345678'])
        
        # +47 conversion
        result = normalize_value('+4799999999', 'phone')
        self.assertIn('+4799999999', result)
        self.assertIn('004799999999', result)
        
        # International numbers (with conversion)
        result2 = normalize_value('+1234567890', 'phone')
        self.assertIn('+1234567890', result2)
        self.assertIn('001234567890', result2)
        
        result3 = normalize_value('001234567890', 'phone')
        self.assertIn('001234567890', result3)
        self.assertIn('+1234567890', result3)
    
    def test_normalize_value_org_fnr(self):
        """Test org and fnr normalization"""
        self.assertEqual(normalize_value('111 222 333', 'org'), ['111222333'])
        self.assertEqual(normalize_value('123456 78901', 'fnr'), ['12345678901'])
    
    def test_normalize_value_email(self):
        """Test email normalization"""
        # Email addresses should preserve original format
        self.assertEqual(normalize_value('example@test.no', 'email'), ['example@test.no'])
        self.assertEqual(normalize_value('  test@example.com  ', 'email'), ['test@example.com'])
        self.assertEqual(normalize_value('user.name+tag@domain.org', 'email'), ['user.name+tag@domain.org'])
    
    def test_is_permitted_value_phone(self):
        """Test phone number permission checking"""
        config_path = self.create_temp_config(self.test_config_content)
        permitted, _ = load_permitted_values(config_path)
        
        # Direct match
        self.assertTrue(is_permitted_value('99999999', 'phone', permitted))
        
        # With spaces (should normalize and match)
        self.assertTrue(is_permitted_value('99 99 99 99', 'phone', permitted))
        
        # +47 variant (should match auto-generated)
        self.assertTrue(is_permitted_value('+4799999999', 'phone', permitted))
        
        # 0047 variant (should match auto-generated)
        self.assertTrue(is_permitted_value('004799999999', 'phone', permitted))
        
        # Not permitted
        self.assertFalse(is_permitted_value('88888888', 'phone', permitted))
        self.assertFalse(is_permitted_value('+4788888888', 'phone', permitted))
    
    def test_is_permitted_value_org_fnr(self):
        """Test org and fnr permission checking"""
        config_path = self.create_temp_config(self.test_config_content)
        permitted, _ = load_permitted_values(config_path)
        
        # Org numbers
        self.assertTrue(is_permitted_value('111222333', 'org', permitted))
        self.assertTrue(is_permitted_value('111 222 333', 'org', permitted))  # With spaces
        self.assertFalse(is_permitted_value('999888777', 'org', permitted))
        
        # FNR
        self.assertTrue(is_permitted_value('90909011223', 'fnr', permitted))
        self.assertTrue(is_permitted_value('909090 11223', 'fnr', permitted))  # With spaces
        self.assertFalse(is_permitted_value('11111111111', 'fnr', permitted))
    
    def test_is_permitted_value_email(self):
        """Test email permission checking"""
        config_path = self.create_temp_config(self.test_config_content)
        permitted, _ = load_permitted_values(config_path)
        
        # Permitted emails
        self.assertTrue(is_permitted_value('example@test.no', 'email', permitted))
        self.assertTrue(is_permitted_value('test@example.com', 'email', permitted))
        
        # Not permitted
        self.assertFalse(is_permitted_value('user@secret.com', 'email', permitted))
        self.assertFalse(is_permitted_value('admin@private.org', 'email', permitted))

    def test_phone_regex_patterns(self):
        """Test phone number regex patterns"""
        test_cases = [
            # Norwegian 8-digit
            ('99999999', True),
            ('99 99 99 99', True),
            ('12345678', True),
            ('1234567', False),  # Too short
            ('123456789', False),  # Too long (would match as org)
            
            # International +XX format
            ('+4799999999', True),
            ('+47 99 99 99 99', True),
            ('+1234567890', True),
            ('+12 345 678 90', True),
            ('+123456789012345', False),  # Too long (over 12 digits after country code)
            ('+12345678901234', True),   # Max allowed (12 digits after country code)
            
            # 00XX format
            ('004799999999', True),
            ('0047 9999 9999', True),
            ('001234567890', True),
            ('00 12 3456 7890', True),
        ]
        
        phone_patterns = PATTERNS['phone']
        for test_value, should_match in test_cases:
            matched = False
            for pattern in phone_patterns:
                if re.search(pattern, test_value):
                    matched = True
                    break
            
            if should_match:
                self.assertTrue(matched, f"'{test_value}' should match phone patterns")
            else:
                self.assertFalse(matched, f"'{test_value}' should NOT match phone patterns")
    
    def test_org_regex_patterns(self):
        """Test organization number regex patterns"""
        test_cases = [
            ('111222333', True),
            ('111 222 333', True),
            ('987654321', True),
            ('12345678', False),   # Too short (8 digits = phone)
            ('1234567890', False), # Too long (10+ digits = phone)
        ]
        
        org_patterns = PATTERNS['org']
        for test_value, should_match in test_cases:
            matched = False
            for pattern in org_patterns:
                if re.search(pattern, test_value):
                    matched = True
                    break
            
            if should_match:
                self.assertTrue(matched, f"'{test_value}' should match org patterns")
            else:
                self.assertFalse(matched, f"'{test_value}' should NOT match org patterns")
    
    def test_fnr_regex_patterns(self):
        """Test personal number regex patterns"""
        test_cases = [
            ('12345678901', True),
            ('123456 78901', True),
            ('90909011223', True),
            ('909090 11223', True),
            ('1234567890', False),   # Too short (10 digits)
            ('123456789012', False), # Too long (12 digits)
        ]
        
        fnr_patterns = PATTERNS['fnr']
        for test_value, should_match in test_cases:
            matched = False
            for pattern in fnr_patterns:
                if re.search(pattern, test_value):
                    matched = True
                    break
            
            if should_match:
                self.assertTrue(matched, f"'{test_value}' should match fnr patterns")
            else:
                self.assertFalse(matched, f"'{test_value}' should NOT match fnr patterns")
    
    def test_ignore_file_patterns(self):
        """Test file ignore patterns"""
        config_path = self.create_temp_config(self.test_config_content)
        _, ignore_patterns = load_permitted_values(config_path)
        
        # Create mock root path
        root_path = Path(self.temp_dir)
        
        # Test cases: (file_path_relative_to_root, should_be_ignored)
        test_cases = [
            ('SomeFile.test.cs', True),         # *.test.cs
            ('TestHelper.cs', True),            # *Test*.cs
            ('MyTestClass.cs', True),           # *Test*.cs
            ('test/somefile.txt', True),        # test/*
            ('deep/test/nested.cs', True),      # **/test/**
            ('node_modules/lib.js', True),      # node_modules/*
            ('normal_file.cs', False),          # Should not be ignored
            ('testing.py', False),              # Should not be ignored (doesn't match *Test*.cs)
            ('tests.txt', False),               # Should not be ignored (doesn't match test/*)
        ]
        
        for relative_path, should_ignore in test_cases:
            file_path = root_path / relative_path
            result = should_ignore_file(file_path, root_path, ignore_patterns)
            self.assertEqual(result, should_ignore, 
                           f"File '{relative_path}' ignore result mismatch")
    
    def test_scan_file_basic(self):
        """Test basic file scanning"""
        config_path = self.create_temp_config(self.test_config_content)
        permitted, _ = load_permitted_values(config_path)
        
        test_content = """Line 1: No PII here
Line 2: Phone 99999999 (should be OK)
Line 3: Unknown phone 88888888 (should warn)
Line 4: Org 111222333 (should be OK)
Line 5: Unknown org 555666777 (should warn)
Line 6: FNR 90909011223 (should be OK)
Line 7: Email example@test.no (should be OK)
Line 8: Unknown email user@secret.com (should warn)
"""
        
        test_file = self.create_temp_file('test.txt', test_content)
        findings = scan_file(test_file, permitted, Path(self.temp_dir))
        
        # Should find 8 PII values
        self.assertEqual(len(findings), 8)
        
        # Debug: print actual findings
        for finding in findings:
            print(f"Found {finding[0]}: {finding[1]} at {finding[2]}:{finding[3]}")
        
        # Check specific findings
        phone_findings = [f for f in findings if f[0] == 'phone']
        org_findings = [f for f in findings if f[0] == 'org']
        fnr_findings = [f for f in findings if f[0] == 'fnr']
        email_findings = [f for f in findings if f[0] == 'email']
        
        self.assertEqual(len(phone_findings), 2)
        self.assertEqual(len(org_findings), 2)  
        self.assertEqual(len(fnr_findings), 2)
        self.assertEqual(len(email_findings), 2)
        
        # Check line numbers
        line_numbers = [f[3] for f in findings]
        expected_lines = [2, 3, 4, 5, 6, 6, 7, 8]  # Line 6 has both org and fnr
        self.assertEqual(sorted(line_numbers), sorted(expected_lines))
    
    def test_scan_file_with_spaces(self):
        """Test scanning file with spaced numbers"""
        config_path = self.create_temp_config(self.test_config_content)
        permitted, _ = load_permitted_values(config_path)
        
        test_content = """Line 1: Phone 99 99 99 99 (should be OK)
Line 2: Phone +47 99 99 99 99 (should be OK)  
Line 3: Phone 0047 9999 9999 (should be OK)
Line 4: Org 111 222 333 (should be OK)
Line 5: FNR 909090 11223 (should be OK)
Line 6: Email example@test.no (should be OK)
"""
        
        test_file = self.create_temp_file('test_spaces.txt', test_content)
        findings = scan_file(test_file, permitted, Path(self.temp_dir))
        
        # Should find 6 PII values, all should be permitted
        self.assertEqual(len(findings), 6)
        
        # Check that all match expected patterns
        phone_findings = [f for f in findings if f[0] == 'phone']
        org_findings = [f for f in findings if f[0] == 'org']
        fnr_findings = [f for f in findings if f[0] == 'fnr']
        email_findings = [f for f in findings if f[0] == 'email']
        
        self.assertEqual(len(phone_findings), 3)  # Lines 1, 2, 3
        self.assertEqual(len(org_findings), 1)    # Line 4
        self.assertEqual(len(fnr_findings), 1)    # Line 5
        self.assertEqual(len(email_findings), 1)  # Line 6
    
    def test_international_phone_patterns(self):
        """Test international phone number patterns"""
        test_cases = [
            # US numbers
            ('+1234567890', True),
            ('001234567890', True),
            
            # UK numbers  
            ('+441234567890', True),
            ('00441234567890', True),
            
            # German numbers
            ('+4912345678901', True),
            ('004912345678901', True),
            
            # Very long international
            ('+123456789012345', True),
            ('00123456789012345', True),
            
            # Too long (over 12 digits after country code)
            ('+123456789012345', False),
            ('00123456789012345', False),
        ]
        
        phone_patterns = PATTERNS['phone']
        for test_value, should_match in test_cases:
            matched = False
            for pattern in phone_patterns:
                if re.search(pattern, test_value):
                    matched = True
                    break
            
            if should_match:
                self.assertTrue(matched, f"'{test_value}' should match international phone patterns")
            else:
                self.assertFalse(matched, f"'{test_value}' should NOT match phone patterns")
    
    def test_email_regex_patterns(self):
        """Test email regex patterns"""
        test_cases = [
            ('example@test.no', True),
            ('user@domain.com', True),
            ('user.name@domain.org', True),
            ('user+tag@domain.co.uk', True),
            ('user123@test-domain.com', True),
            ('Test.Email@Example.COM', True),  # Case insensitive
            ('invalid.email', False),         # No @ symbol
            ('@domain.com', False),           # No local part
            ('user@', False),                 # No domain
            ('user@domain', False),           # No TLD
            ('user_name@domain.com', True),   # Underscore allowed
            ('user name@domain.com', False),  # Space in local part
            ('user@domain .com', False),      # Space in domain
        ]
        
        email_patterns = PATTERNS['email']
        for test_value, should_match in test_cases:
            matched = False
            for pattern in email_patterns:
                if re.search(pattern, test_value):
                    matched = True
                    break
            
            if should_match:
                self.assertTrue(matched, f"'{test_value}' should match email patterns")
            else:
                self.assertFalse(matched, f"'{test_value}' should NOT match email patterns")

if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)