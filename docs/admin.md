# Admin API

All admin endpoints are served from the **Admin** app (`admin.getmaterio.app`) under `/api/v2/admin/`. Every request requires admin authentication — a valid JWT Bearer token belonging to a user with `has_admin_privileges: true`.

```
Authorization: Bearer <admin-token>
```

---

## User Management

### Search Users

#### `GET /api/v2/admin/users/search?q=<query>`

Search users by username, display name, or email. The `@` prefix is stripped automatically.

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | `string` | `""` | Search query. Empty returns 10 most recent users. |

**Response `200`**

```json
{
  "users": [
    {
      "id": "uuid",
      "username": "john_doe",
      "display_name": "John Doe",
      "email": "john@paruluniversity.ac.in",
      "profile_picture": "https://..."
    }
  ]
}
```

### Toggle User Privileges

#### `POST /api/v2/admin/users/toggle-admin`

Grant or revoke admin privileges.

```json
{
  "userId": "uuid",
  "makeAdmin": true
}
```

#### `POST /api/v2/admin/users/toggle-plus`

Grant or revoke Plus subscription.

```json
{
  "userId": "uuid",
  "makePlus": true
}
```

**Response `200`**

```json
{
  "success": true,
  "user": { "id": "uuid", "has_admin_privileges": true, ... }
}
```

---

## Bans & Moderation

Moderation rules are stored in MongoDB (`abuse_moderation_rules` collection). Two ban types are supported: **account bans** and **anonymous/device bans**.

### List All Bans

#### `GET /api/v2/admin/bans`

**Response `200`**

```json
{
  "bans": [
    {
      "id": "mongo_objectid",
      "target_type": "account",
      "user_id": "uuid",
      "username": "john_doe",
      "email": "john@...",
      "reason": "Violation of terms",
      "active": true,
      "ip": null,
      "fingerprint": null,
      "anon_id": null,
      "created_at": "2025-09-01T..."
    }
  ]
}
```

### Create Ban

#### `POST /api/v2/admin/bans`

**Account ban:**

```json
{
  "target_type": "account",
  "username": "john_doe",
  "reason": "Violation of community guidelines"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `target_type` | `string` | No | `"account"` or `"anonymous"` (auto-detected) |
| `user_id` | `string` | One of | User UUID |
| `username` | `string` | One of | Username (auto-resolves to full user record) |
| `reason` | `string` | ✅ | Reason for ban (alias: `body`) |

**Anonymous/device ban:**

```json
{
  "target_type": "anonymous",
  "anon_id": "anon_abc123",
  "fingerprint": "fp_hash...",
  "ip": "203.0.113.42",
  "reason": "Abuse detected"
}
```

At least one identifier (`anon_id`, `fingerprint`, or `ip`) is required.

**Response `200`**

```json
{
  "success": true,
  "id": "mongo_objectid",
  "rule": { ... }
}
```

### Update Ban

#### `PATCH /api/v2/admin/bans`

```json
{
  "id": "mongo_objectid",
  "active": false,
  "reason": "Updated reason"
}
```

### Delete Ban

#### `DELETE /api/v2/admin/bans?id=<mongo_objectid>`

or

#### `DELETE /api/v2/admin/bans/<id>`

**Response `200`**

```json
{ "success": true }
```

---

## Invite Codes

### List Invites

#### `GET /api/v2/admin/invites`

Returns all invite codes with their redemption history and redeemer user profiles.

**Response `200`**

```json
{
  "invites": [
    {
      "id": 1,
      "code": "MATERIO-PLUS",
      "created_by": "admin-uuid",
      "contains_plus_perks": true,
      "expires_at": "2025-12-31T...",
      "redeemed": false,
      "max_uses": 10,
      "current_uses": 3,
      "created_at": "2025-01-01T...",
      "redemptions": [
        {
          "redeemed_at": "2025-02-15T...",
          "user": {
            "id": "uuid",
            "username": "john_doe",
            "display_name": "John Doe",
            "profile_picture": "https://...",
            "has_admin_privileges": false,
            "is_plus_user": true
          }
        }
      ]
    }
  ]
}
```

### Create Invite

#### `POST /api/v2/admin/invites`

```json
{
  "customCode": "WELCOME-2025",
  "containsPlusPerks": true,
  "expiresInDays": 30,
  "maxUses": 50
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `customCode` | `string` | random hex | Custom code string |
| `containsPlusPerks` | `boolean` | `false` | Whether redeeming grants Plus subscription |
| `expiresInDays` | `number` | `30` | Days until expiration |
| `maxUses` | `number` | `1` | Maximum number of redemptions |

**Response `200`**

```json
{
  "success": true,
  "invite": { ... },
  "code": "WELCOME-2025"
}
```

### Delete Invite

#### `DELETE /api/v2/admin/invites?code=<code>`

---

## Notifications

### List Notifications

#### `GET /api/v2/admin/notifications`

Returns all platform notifications (stored in MongoDB `notifications` collection).

**Response `200`**

```json
{
  "notifications": [
    {
      "id": "mongo_objectid",
      "title": "New Feature Released",
      "body": "Check out the new dashboard!",
      "link": "https://...",
      "category": "update",
      "sentAt": "2025-09-01T...",
      "status": "Sent"
    }
  ]
}
```

### Send Notification

#### `POST /api/v2/admin/notifications/send`

```json
{
  "title": "Maintenance Notice",
  "body": "The platform will be down for 30 minutes.",
  "category": "system",
  "link": "https://status.getmaterio.app"
}
```

**Response `200`**

```json
{ "success": true }
```

### Edit Notification

#### `PUT /api/v2/admin/notifications?id=<mongo_objectid>`

```json
{
  "title": "Updated Title",
  "body": "Updated body text",
  "category": "update",
  "link": "https://..."
}
```

### Delete Notification

#### `DELETE /api/v2/admin/notifications?id=<mongo_objectid>`

---

## Releases

### List Releases

#### `GET /api/v2/admin/releases`

Returns all platform releases sorted by date descending.

**Response `200`**

```json
{
  "releases": [
    {
      "id": "mongo_objectid",
      "version": "4.2.0",
      "branch": "stable",
      "notes": "Bug fixes and performance improvements",
      "date": "2025-09-01",
      "link": "https://github.com/...",
      "status": "Active"
    }
  ]
}
```

### Create Release

#### `POST /api/v2/admin/releases`

```json
{
  "version": "4.3.0",
  "branch": "stable",
  "notes": "New OAuth integration",
  "date": "2025-09-14",
  "link": "https://github.com/...",
  "status": "Active"
}
```

### Update Release

#### `PUT /api/v2/admin/releases`

Include `id` in the body or as `?id=` query param.

```json
{
  "id": "mongo_objectid",
  "notes": "Updated release notes",
  "status": "Deprecated"
}
```

### Delete Release

#### `DELETE /api/v2/admin/releases?id=<mongo_objectid>`

---

## Promotions

Promotions are banner cards shown in the main app. Only one promotion can be active at a time.

### List Promotions

#### `GET /api/v2/admin/promotions`

| Param | Description |
|---|---|
| `all=true` | Include inactive promotions |

**Response `200`**

```json
{
  "promotions": [
    {
      "id": "mongo_objectid",
      "title": "Summer Sale",
      "description": "Get 50% off Pro subscription",
      "category": "whats-new",
      "buttonText": "Learn More",
      "buttonLink": "https://...",
      "imageUrl": "https://...",
      "isActive": true,
      "createdAt": "2025-06-01T..."
    }
  ]
}
```

### Create Promotion

#### `POST /api/v2/admin/promotions`

```json
{
  "title": "New Feature",
  "description": "Explore the new reading insights dashboard",
  "category": "whats-new",
  "buttonText": "Check it out",
  "buttonLink": "/insights",
  "imageUrl": "https://...",
  "isActive": true
}
```

> Setting `isActive: true` automatically deactivates all other promotions.

### Update Promotion

#### `PUT /api/v2/admin/promotions`

Include `id` in the body or as `?id=` query param.

### Delete Promotion

#### `DELETE /api/v2/admin/promotions?id=<mongo_objectid>`

---

## Exams

### List Exams

#### `GET /api/v2/admin/exams`

**Response `200`**

```json
{
  "exams": [
    {
      "id": "mongo_objectid",
      "title": "Mid-Semester Exam",
      "date": "2025-10-15",
      "department": "CSE",
      "semester": "5",
      "status": "Upcoming"
    }
  ]
}
```

### Create Exam

#### `POST /api/v2/admin/exams`

```json
{
  "title": "End-Semester Exam",
  "date": "2025-12-01",
  "department": "CSE",
  "semester": "5",
  "status": "Upcoming"
}
```

### Update Exam

#### `PUT /api/v2/admin/exams`

### Delete Exam

#### `DELETE /api/v2/admin/exams?id=<mongo_objectid>`

### Exam Config

#### `GET /api/v2/admin/exams/config`

Get global exam configuration.

#### `POST /api/v2/admin/exams/config`

Upsert global exam configuration (freeform JSON body).

---

## Reading Insights

### `GET /api/v2/admin/reading-insights`

Fetch platform-wide reading analytics (top PDFs and top readers).

| Param | Type | Default | Description |
|---|---|---|---|
| `period` | `string` | `"all_time"` | Time period |
| `limit` | `number` | `50` | Max results per list (1–50) |
| `pdfSearch` | `string` | `null` | Filter PDFs by title substring |

**Response `200`**

```json
{
  "period": "all_time",
  "range": null,
  "filters": { "pdfSearch": null },
  "top_pdfs": [
    { "title": "Data Structures Notes", "total_views": 1420, ... }
  ],
  "top_users": [
    { "username": "john_doe", "total_reading_sec": 36000, ... }
  ]
}
```

> Data is sourced from Supabase RPCs `get_top_pdfs_v4` and `get_top_readers_v4`.

---

## CDN Management

File management for the GitHub-based CDN (`Materioa/cdn-materio`).

### Browse Files

#### `GET /api/v2/admin/cdn?path=<path>`

List directory contents or get file metadata.

**Response `200` (directory)**

```json
[
  {
    "name": "notes.pdf",
    "path": "pdfs/sem5/DSA/notes/notes.pdf",
    "type": "file",
    "size": 1048576,
    "download_url": "https://raw.githubusercontent.com/..."
  }
]
```

### Upload File

#### `POST /api/v2/admin/cdn`

Upload via `multipart/form-data`:

| Field | Type | Description |
|---|---|---|
| `file` | `File` | The file to upload |
| `path` | `string` | Destination path in the repo |

### Bulk Commit

#### `POST /api/v2/admin/cdn?commit=true`

Commit multiple files in a single Git tree operation.

```json
{
  "stagedFiles": [
    { "path": "pdfs/sem5/DSA/notes/ch1.pdf", "content": "<base64>" }
  ],
  "stagedJsonFiles": [
    { "path": "databases/beta/config.json", "content": "{...}" }
  ],
  "commitMessage": "Upload new DSA materials",
  "autoPushNotify": true
}
```

> When `autoPushNotify` is `true` and there are staged files, `notifications.json` and `databases/beta/resource.lib.json` are automatically updated.

### Rename File

#### `PUT /api/v2/admin/cdn`

```json
{
  "oldPath": "pdfs/sem5/DSA/notes/old.pdf",
  "newPath": "pdfs/sem5/DSA/notes/new.pdf"
}
```

### Delete File

#### `DELETE /api/v2/admin/cdn?path=<path>`

### Create Directory

#### `POST /api/v2/admin/cdn`

```json
{
  "type": "directory",
  "path": "pdfs/sem6/newsubject"
}
```

---

## Upload (Supabase Storage)

### `POST /api/v2/admin/upload`

Upload a file to Supabase `attachments` storage bucket via `multipart/form-data`.

| Field | Type | Description |
|---|---|---|
| `file` | `File` | The file to upload |
| `path` | `string` | Optional custom storage path |

**Response `200`**

```json
{
  "success": true,
  "url": "https://<your-project-id>.supabase.co/storage/v1/object/public/attachments/..."
}
```
