# Security Specification & Threat Model

## 1. Data Invariants
- **Identity Invariant**: A user document at `/users/{userId}` can only be read, created, or modified by the authenticated owner (`request.auth.uid == userId`).
- **Subcollection Invariant**: Rides in `/users/{userId}/rides/{rideId}` and routes in `/users/{userId}/savedRoutes/{routeId}` are owned exclusively by `userId`. A user cannot view, write, alter, or delete another user's recorded tracks.
- **Relational Integrity**: The `userId` property within the document payload must strictly match the authenticated user's UID (`request.auth.uid`) and the path parameter `{userId}`.
- **Payload Boundaries**: All strings must be constrained in length (e.g. `name.size() <= 120`, `notes.size() <= 1000`). All IDs must be alpha-numeric slug identifiers (`isValidId`).
- **Default Deny Catch-All**: Any unspecified path must be inaccessible (`match /{document=**} { allow read, write: if false; }`).

## 2. The "Dirty Dozen" Payloads (Designed to break laws of Identity, Integrity, and State)

1. **Payload 1 (Ghost Field Injection / Privilege Escalation)**:
   Attempt to create a user profile with an unauthorized `isAdmin: true` field.
   *Expected: REJECTED*.

2. **Payload 2 (Identity Spoofing - Impersonation)**:
   Authenticated user `user_A` writes to `/users/user_B` with payload `{"id": "user_B", "email": "victim@example.com"}`.
   *Expected: PERMISSION_DENIED*.

3. **Payload 3 (Cross-Account Ride Injection)**:
   Authenticated user `user_A` writes a ride to `/users/user_B/rides/ride_123`.
   *Expected: PERMISSION_DENIED*.

4. **Payload 4 (Orphaned Write / ID Mismatch)**:
   Authenticated user `user_A` writes to `/users/user_A/rides/ride_1` with payload `{"userId": "user_B", ...}`.
   *Expected: PERMISSION_DENIED*.

5. **Payload 5 (Oversized Payload / Denial of Wallet Attack)**:
   Writing a ride where `name` contains 200,000 characters.
   *Expected: PERMISSION_DENIED*.

6. **Payload 6 (Unauthenticated Ride Extraction / Snooping)**:
   Unauthenticated request (`request.auth == null`) attempting `get` or `list` on `/users/user_A/rides`.
   *Expected: PERMISSION_DENIED*.

7. **Payload 7 (Cross-User Track Deletion)**:
   Authenticated user `user_A` issuing `delete` on `/users/user_B/rides/ride_999`.
   *Expected: PERMISSION_DENIED*.

8. **Payload 8 (Path ID Poisoning)**:
   Attempting to use path with dangerous characters: `/users/user_A/rides/../../../etc/passwd` or non-slug characters.
   *Expected: PERMISSION_DENIED*.

9. **Payload 9 (Type Poisoning - String in Numeric Field)**:
   Payload where `distanceKm: "thirty_five"` or `durationSeconds: false`.
   *Expected: PERMISSION_DENIED*.

10. **Payload 10 (Immutability Violation - Changing Owner on Update)**:
    User attempts to update ride to change `userId` from `user_A` to `user_B`.
    *Expected: PERMISSION_DENIED*.

11. **Payload 11 (Unauthenticated User Directory Crawling)**:
    Querying `/users` collection list without authentication or cross-account.
    *Expected: PERMISSION_DENIED*.

12. **Payload 12 (Negative Telemetry Invariant)**:
    Attempting to save ride with negative distance (`distanceKm: -50`) or negative duration (`durationSeconds: -300`).
    *Expected: PERMISSION_DENIED*.
