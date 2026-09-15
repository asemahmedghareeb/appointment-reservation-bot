# VFS EG → GR Route Specification

## Route Metadata
- **Provider**: VFS Global (`VFS`)
- **Source Country**: Egypt (`EG`)
- **Destination Country**: Greece (`GR`)
- **Status**: Verified in Phase 3 synthetic environment

## Flow Specification
- **Entry URL**: `https://visa.vfsglobal.com` (verified synthetic entry)
- **Authentication**: Email + Password account login with post-login OTP challenge detection
- **Application Centres**: Cairo (`CAI`), Alexandria (`ALY`) (Configurable, subject to live verification)
- **Visa Categories**: Schengen Visa (Short Stay)
- **Visa Subcategories**: Tourism, Business, Family Visit
- **Availability Mode**: `EARLIEST_SLOT` / `CALENDAR`
- **Group Behavior**: Supported up to 4-5 applicants per group booking case
- **Human Verification**: CAPTCHA detection on entry/login, OTP detection on submission/payment
- **Payment**: Provider fees payable at checkout or at application centre
- **Confirmation**: Booking reference confirmation with appointment letter details
- **Page Profile**: `VFS_STANDARD_V1`
