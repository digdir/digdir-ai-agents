---
title: Test Document
description: Original description of the document
weight: 10
---

This page provides a comprehensive reference for all error codes.

## Error Code Format

The API uses unique error codes in the format `ERR-XXXXX` where `ERR` stands for Error and `XXXXX` is a five-digit number.

These error codes are returned in the `code` field in problem detail responses.

## Error Codes

### ERR-00001: Missing Information

**HTTP Status:** 422 Unprocessable Entity

**Description:** The API could not process the request because one or more recipients do not have the required information available.

**Common causes:**
- The recipient has not registered an email address or phone number
- The recipient has registered contact information, but it is not valid or verified
- For organization recipients, the organization may not have registered contact details

**Affected endpoints:**
- `POST /orders` - Creating orders with recipient lookup

**Example response:**
```json
{
  "status": 422,
  "code": "ERR-00001",
  "detail": "Missing information for recipient(s)"
}
```

**Solution:**
- Verify that the recipient's ID is correct
- Ask the recipient to register their contact information
- Consider using direct fields instead of recipient lookup
