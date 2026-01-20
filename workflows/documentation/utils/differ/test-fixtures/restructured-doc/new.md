---
title: Test Document
description: Reference for error codes in the API
weight: 10
---

This page describes the error codes that the API returns.

## Overview of Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `ERR-00001` | Missing information | 422 |

## Error Code Format

Error codes have the format `ERR-XXXXX` where `ERR` stands for Error and `XXXXX` is a five-digit number.

Error codes are returned in the `code` field in the response.

## Error Codes

### ERR-00001: Missing Information

**HTTP Status:** 422 Unprocessable Entity

**Description:** One or more recipients are missing required information.

**Common causes:**
- The recipient has not registered email address or phone number
- Contact information is not valid or verified
- The organization has not registered contact details

**Affected endpoints:**
- `POST /orders` - Creating orders with recipient lookup

**Example response:**
```json
{
  "type": "https://example.com/error",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Missing information for recipient(s)",
  "code": "ERR-00001"
}
```

**Solution:**
- Check that the recipient's ID is correct
- Ask the recipient to register contact information
- Use direct fields instead of recipient lookup
