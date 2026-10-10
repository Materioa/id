import { json, type RequestHandler } from '@sveltejs/kit';
import { validateToken } from '$lib/server/insightroom-auth';
import { getInsightroomDb } from '$lib/server/mongo';
import { getAllPosts, getPost, getPostByPermalink, getPostsCollection, slugify } from '$lib/server/insightroom-posts';
import { getAllExodusPosts, getExodusPostById, saveExodusPost, deleteExodusPost, type ExodusDocType } from '$lib/server/exodus-content';
import { ObjectId } from 'mongodb';
import crypto from 'node:crypto';
import { resolveAttribution } from '$lib/server/insightroom-attribution';
import { getPostAnalytics, getGeneralAnalytics } from '$lib/server/insightroom-analytics';
import { styleGuidelines } from '$lib/server/insightroom-guidelines';

// In-memory registry of active SSE streams
const activeSessions = new Map<string, ReadableStreamDefaultController>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

function sendSseMessage(sessionId: string, message: any): boolean {
  const controller = activeSessions.get(sessionId);
  if (controller) {
    try {
      const data = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
      return true;
    } catch (err) {
      console.error(`[MCP SSE] Failed to write to session ${sessionId}:`, err);
      activeSessions.delete(sessionId);
    }
  }
  return false;
}

export const GET: RequestHandler = async ({ request, url, fetch }) => {
  const authHeader = request.headers.get('Authorization');
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = url.searchParams.get('token') || '';
  }

  if (!token) {
    return new Response('Unauthorized: Missing Token', {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource"`,
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  let tokenValidationResult;
  try {
    tokenValidationResult = await validateToken(token, fetch);
  } catch {
    tokenValidationResult = { user: null, accessTier: 'guest' as const };
  }
  const { user, accessTier } = tokenValidationResult;

  if (!user || accessTier !== 'super') {
    return new Response('Unauthorized: Admin access required', {
      status: 403,
      headers: {
        'WWW-Authenticate': `Bearer error="insufficient_scope", scope="admin", resource_metadata="${url.origin}/.well-known/oauth-protected-resource"`,
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const sessionId = crypto.randomUUID();
  const stream = new ReadableStream({
    start(controller) {
      activeSessions.set(sessionId, controller);

      const endpointUri = `${url.origin}${url.pathname}?sessionId=${sessionId}&token=${encodeURIComponent(token)}`;
      const initEvent = `event: endpoint\ndata: ${endpointUri}\n\n`;
      controller.enqueue(new TextEncoder().encode(initEvent));

      const interval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch {
          clearInterval(interval);
          activeSessions.delete(sessionId);
        }
      }, 30000);
    },
    cancel() {
      activeSessions.delete(sessionId);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    }
  });
};

export const POST: RequestHandler = async ({ request, url, fetch }) => {
  const authHeader = request.headers.get('Authorization');
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = url.searchParams.get('token') || '';
  }

  let rpcId: any = null;
  try {
    const clonedReq = request.clone();
    const bodyData = (await clonedReq.json()) as any;
    rpcId = bodyData.id || null;
  } catch {}

  if (!token) {
    return json(
      {
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32001, message: 'Unauthorized: Missing Token' }
      },
      { headers: corsHeaders }
    );
  }

  const { user, accessTier } = await validateToken(token, fetch);
  if (!user || accessTier !== 'super') {
    return json(
      {
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32003, message: 'Unauthorized: Admin privileges required' }
      },
      { headers: corsHeaders }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null },
      { status: 400, headers: corsHeaders }
    );
  }

  const { jsonrpc, id, method, params } = body;
  if (jsonrpc !== '2.0' || !method) {
    return json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: id || null },
      { status: 400, headers: corsHeaders }
    );
  }

  const sessionId = url.searchParams.get('sessionId') || '';
  let result: any = null;
  let error: any = null;

  try {
    switch (method) {
      case 'initialize': {
        const clientVersion = params?.protocolVersion;
        const supportedVersions = ['2024-11-05', '2025-11-25'];
        const negotiatedVersion = supportedVersions.includes(clientVersion) ? clientVersion : '2024-11-05';
        result = {
          protocolVersion: negotiatedVersion,
          capabilities: { tools: {} },
          serverInfo: {
            name: 'insightroom-mcp-server',
            version: '1.0.0'
          },
          instructions: `You are the Insightroom content writer agent. The user will use slash commands in the chat. Map them as follows:
- When the user types "/create <title>", call the tool "create_post" with that title (and set draft to true in metadata).
- When the user types "/outline <topic/content>", call the tool "outline" with that topic, then use the returned proprietary style guidelines to generate a high-quality article draft/outline in clean markdown format. Show it in the chat.
- When the user types "/publish", take the last generated markdown article and write it to the post by calling "update_post" with the post ID, setting the "content" parameter, and setting the "draft" field to false in metadata.
- When the user types "/delete", call the tool "delete_post" with the active post ID.

Always remember the active post ID returned from "create_post" or "list_posts" to perform subsequent operations like publish or delete.`
        };
        break;
      }

      case 'tools/list': {
        const toolsList = [
          {
            name: 'list_posts',
            title: 'List Posts',
            description: 'Retrieve a list of all posts in the insightroom database (room scope) or the getmaterio.app repository (exodus scope: changelogs, docs, legal pages). Defaults to room scope.',
            inputSchema: {
              type: 'object',
              properties: {
                scope: {
                  type: 'string',
                  enum: ['room', 'exodus', 'all'],
                  description: "Publishing target scope: 'room' for room.getmaterio.app (default), 'exodus' for getmaterio.app markdown content, or 'all'."
                },
                doc_type: {
                  type: 'string',
                  enum: ['all', 'changelog', 'doc', 'legal'],
                  description: "Filter exodus scope by document type: 'changelog' (whats-new), 'doc', or 'legal' pages."
                }
              }
            },
            outputSchema: { type: 'array', items: { type: 'object' } }
          },
          {
            name: 'get_post',
            title: 'Get Post Details',
            description: 'Fetch the full details of a specific post by its ID (MongoDB ObjectId or exodus ID like exodus:post:...), slug, or permalink.',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'The unique post ID (MongoDB ObjectId or exodus ID).' },
                slug: { type: 'string', description: 'The post slug.' },
                categorySlug: { type: 'string', description: 'The slug of the post category.' },
                permalink: { type: 'string', description: 'The custom permalink URL.' },
                scope: {
                  type: 'string',
                  enum: ['room', 'exodus'],
                  description: "Optional scope indicator ('room' or 'exodus'). Automatically detected if id begins with 'exodus:'."
                }
              }
            },
            outputSchema: { type: 'object' }
          },
          {
            name: 'create_post',
            title: 'Create Post',
            description: 'Create and publish a new post. Supports publishing to room.getmaterio.app (MongoDB, scope="room") or getmaterio.app (project-exodus, scope="exodus"). For exodus scope, choose doc_type: "changelog", "doc", or "legal".',
            inputSchema: {
              type: 'object',
              properties: {
                scope: {
                  type: 'string',
                  enum: ['room', 'exodus'],
                  description: "Publishing scope: 'room' (default: room.getmaterio.app) or 'exodus' (getmaterio.app site)."
                },
                doc_type: {
                  type: 'string',
                  enum: ['changelog', 'doc', 'legal'],
                  description: "For exodus scope: 'changelog' (saved to src/posts/ with category whats-new), 'doc' (src/posts/), or 'legal' (src/pages/)."
                },
                title: { type: 'string', description: 'The title of the post or page.' },
                slug: { type: 'string', description: 'Custom slug. If not provided, it will be automatically generated from the title.' },
                content: { type: 'string', description: 'The content/body of the post (Markdown format).' },
                metadata: {
                  type: 'object',
                  description: 'Key-value metadata such as categories, tags, excerpt, date, author details, image, or custom fields.',
                  properties: {
                    excerpt: { type: 'string' },
                    date: { type: 'string', description: 'Format YYYY-MM-DD' },
                    category: { type: 'string' },
                    visibility: { type: 'string', enum: ['public', 'private'] },
                    draft: { type: 'boolean' },
                    hidden: { type: 'boolean' },
                    image: { type: 'string', description: 'Cover image URL.' },
                    author_name: { type: 'string', description: "The name of the author. E.g. 'claude.ai'." },
                    author_avatar: { type: 'string', description: "The avatar URL of the author." }
                  }
                }
              },
              required: ['title']
            },
            outputSchema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                id: { type: 'string' }
              },
              required: ['success', 'message', 'id']
            }
          },
          {
            name: 'update_post',
            title: 'Update Post',
            description: 'Update or edit details, content, or metadata of an existing post across either room or exodus scope.',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'The unique post ID (MongoDB ObjectId or exodus ID).' },
                scope: { type: 'string', enum: ['room', 'exodus'] },
                doc_type: { type: 'string', enum: ['changelog', 'doc', 'legal'] },
                title: { type: 'string' },
                slug: { type: 'string' },
                content: { type: 'string' },
                metadata: {
                  type: 'object',
                  properties: {
                    excerpt: { type: 'string' },
                    date: { type: 'string' },
                    category: { type: 'string' },
                    visibility: { type: 'string' },
                    draft: { type: 'boolean' },
                    hidden: { type: 'boolean' },
                    image: { type: 'string' },
                    author_name: { type: 'string' },
                    author_avatar: { type: 'string' }
                  }
                },
                saved_by_name: { type: 'string', description: "The identifier of the editor performing this update (e.g. 'claude.ai')." },
                saved_by_display_name: { type: 'string', description: "The display name of the editor (e.g. 'Claude')." },
                saved_by_avatar: { type: 'string', description: 'Explicit avatar URL of the editor.' }
              },
              required: ['id']
            },
            outputSchema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' }
              },
              required: ['success', 'message']
            }
          },
          {
            name: 'delete_post',
            title: 'Delete Post',
            description: 'Permanently delete a post and its revision/version history.',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'The unique post ID (MongoDB ObjectId or exodus ID).' },
                scope: { type: 'string', enum: ['room', 'exodus'] }
              },
              required: ['id']
            },
            outputSchema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' }
              },
              required: ['success', 'message']
            }
          },
          {
            name: 'upload_image',
            title: 'Upload Image Asset',
            description: 'Use this tool to render an interactive UI widget in the chat where the user can manually select or drag-and-drop images to upload.',
            inputSchema: {
              type: 'object',
              properties: {
                post_id: { type: 'string', description: 'The MongoDB ObjectId of the post being edited (optional).' }
              }
            },
            outputSchema: { type: 'object' }
          },
          {
            name: 'get_post_analytics',
            title: 'Get Post Analytics',
            description: 'Retrieve detailed engagement and interaction analytics for a specific post by its ID or slug (views, reading time, scroll depth, claps, location stats, button clicks, settings changes).',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'The MongoDB ObjectId of the post.' },
                slug: { type: 'string', description: 'The post slug.' }
              }
            },
            outputSchema: { type: 'object' }
          },
          {
            name: 'get_general_analytics',
            title: 'Get Site-Wide Analytics',
            description: 'Retrieve collective site-wide analytics dashboard metrics (overall views, total reading time, average scroll depth, retention rate, geographic top countries, and traffic timeline).',
            inputSchema: {
              type: 'object',
              properties: {
                days: { type: 'integer', description: 'Number of days of timeline data to return (default is 30).' }
              }
            },
            outputSchema: { type: 'object' }
          },
          {
            name: 'outline',
            title: 'Generate Outline and Writing Guidelines',
            description: 'Retrieve the proprietary style guidelines and instructions to write or outline content for a specific topic.',
            inputSchema: {
              type: 'object',
              properties: {
                topic: { type: 'string', description: 'The topic or post details to write an outline for.' }
              },
              required: ['topic']
            },
            outputSchema: { type: 'string' }
          }
        ];

        result = {
          tools: toolsList.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          }))
        };
        break;
      }

      case 'tools/call': {
        const { name, arguments: args } = params;
        result = await handleToolCall(name, args, user, request, url);
        break;
      }

      default:
        error = { code: -32601, message: `Method not found: ${method}` };
    }
  } catch (err: any) {
    console.error(`[MCP JSON-RPC] Error processing method ${method}:`, err);
    error = { code: -32603, message: err.message || 'Internal error' };
  }

  const responsePayload: { jsonrpc: string; id: any; error?: any; result?: any } = { jsonrpc: '2.0', id };
  if (error) {
    responsePayload.error = error;
  } else {
    responsePayload.result = result;
  }

  if (sessionId) {
    sendSseMessage(sessionId, responsePayload);
  }

  return json(responsePayload, { headers: corsHeaders });
};

async function handleToolCall(name: string, args: any, currentUser: any, request: Request, url: URL) {
  const collection = await getPostsCollection();
  const db = await getInsightroomDb();

  switch (name) {
    case 'list_posts': {
      const scope = args?.scope || 'room';
      const docType = args?.doc_type || 'all';

      if (scope === 'exodus') {
        const exodusPosts = await getAllExodusPosts({ type: docType });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(exodusPosts, null, 2)
            }
          ]
        };
      }

      const posts = await getAllPosts();
      const lightweightPosts = posts.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        categorySlug: post.categorySlug,
        date: post.date,
        url: post.url,
        hidden: post.hidden,
        draft: post.draft,
        visibility: post.visibility,
        excerpt: post.excerpt,
        image: post.image
      }));

      if (scope === 'all') {
        const exodusPosts = await getAllExodusPosts({ type: docType });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ room: lightweightPosts, exodus: exodusPosts }, null, 2)
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(lightweightPosts, null, 2)
          }
        ]
      };
    }

    case 'get_post': {
      const { id, slug, categorySlug, permalink, scope } = args || {};
      let post: any = null;

      if (id && id.startsWith('exodus:')) {
        post = getExodusPostById(id, true);
      } else if (scope === 'exodus') {
        if (id) {
          post = getExodusPostById(id, true);
        } else if (slug) {
          const allExodus = await getAllExodusPosts({ content: true });
          post = allExodus.find((p) => p.slug === slug || p.filename === slug);
        }
      } else if (id) {
        try {
          const row = await collection.findOne({ _id: new ObjectId(id) });
          if (row) {
            post = {
              id: row._id.toString(),
              slug: row.slug,
              categorySlug: row.categorySlug,
              date: row.date,
              content: row.content,
              hidden: Boolean(row.hidden),
              draft: Boolean(row.draft),
              visibility: row.visibility,
              category: row.category,
              title: row.title,
              excerpt: row.excerpt,
              image: row.image,
              metadata: row.metadata || {}
            };
          }
        } catch {}
      } else if (permalink) {
        post = await getPostByPermalink(permalink);
      } else if (slug && categorySlug) {
        post = await getPost(categorySlug, slug);
      }

      if (!post) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Post not found.' }]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(post, null, 2)
          }
        ]
      };
    }

    case 'create_post': {
      let { title, slug, content, metadata, scope, doc_type } = args || {};
      if (!title) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Title is required.' }]
        };
      }

      if (scope === 'exodus') {
        const attribution = resolveAttribution(
          { saved_by_name: currentUser?.email },
          request.headers
        );
        const res = await saveExodusPost({
          docType: (doc_type as ExodusDocType) || 'doc',
          title,
          slug,
          content: content || '',
          metadata,
          savedByName: attribution.name,
          savedByAvatar: attribution.avatar
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Successfully created exodus post "${title}" at ${res.filePath}`,
                  id: res.id,
                  scope: 'exodus'
                },
                null,
                2
              )
            }
          ]
        };
      }

      if (!slug) slug = slugify(title);
      metadata = metadata || {};

      const draft = Boolean(metadata.draft);
      const category = draft ? 'draft' : (metadata.category || '').trim();
      const categorySlug = draft ? 'draft' : slugify(category);
      metadata.category = category;
      const date = metadata.date || new Date().toISOString().split('T')[0];
      const excerpt = metadata.excerpt || '';
      const image = metadata.image || '';
      const hidden = Boolean(metadata.hidden);
      const visibility = metadata.visibility || 'public';

      const result = await collection.insertOne({
        title,
        slug,
        content,
        metadata,
        category,
        categorySlug,
        date,
        excerpt,
        image,
        hidden,
        draft,
        visibility,
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Successfully created post "${title}"`,
                id: result.insertedId.toString(),
                scope: 'room'
              },
              null,
              2
            )
          }
        ]
      };
    }

    case 'update_post': {
      const { id, title, slug, content, metadata, saved_by_name, saved_by_display_name, saved_by_avatar, scope, doc_type } = args || {};
      if (!id) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Post ID is required for updates.' }]
        };
      }

      if (id.startsWith('exodus:') || scope === 'exodus') {
        const attribution = resolveAttribution(
          { saved_by_name, saved_by_display_name, saved_by_avatar },
          request.headers
        );
        const res = await saveExodusPost({
          id,
          docType: (doc_type as ExodusDocType) || undefined,
          title: title || 'Untitled',
          slug,
          content: content || '',
          metadata,
          savedByName: attribution.name,
          savedByAvatar: attribution.avatar
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Successfully updated exodus file (ID: ${res.id})`,
                  id: res.id,
                  scope: 'exodus'
                },
                null,
                2
              )
            }
          ]
        };
      }

      const oldPost = await collection.findOne({ _id: new ObjectId(id) });
      if (!oldPost) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Post not found.' }]
        };
      }

      const attribution = resolveAttribution(
        {
          saved_by_name,
          saved_by_display_name,
          saved_by_avatar
        },
        request.headers
      );

      const versionsCollection = db.collection('post_versions');
      await versionsCollection.insertOne({
        post_id: oldPost._id,
        title: oldPost.title,
        content: oldPost.content,
        metadata: oldPost.metadata || {},
        updated_at: oldPost.updated_at || oldPost.created_at || new Date(),
        saved_by_name: attribution.name,
        saved_by_display_name: attribution.displayName,
        saved_by_avatar: attribution.avatar,
        version_saved_at: new Date()
      });

      const updateDoc: Record<string, any> = {};
      if (title !== undefined) updateDoc.title = title;
      if (slug !== undefined) updateDoc.slug = slugify(slug);
      if (content !== undefined) updateDoc.content = content;

      if (metadata !== undefined) {
        const newMetadata = { ...(oldPost.metadata || {}), ...metadata };
        updateDoc.metadata = newMetadata;
        if (newMetadata.excerpt !== undefined) updateDoc.excerpt = newMetadata.excerpt;
        if (newMetadata.image !== undefined) updateDoc.image = newMetadata.image;
        if (newMetadata.date !== undefined) updateDoc.date = newMetadata.date;
        if (newMetadata.visibility !== undefined) updateDoc.visibility = newMetadata.visibility;
        if (newMetadata.draft !== undefined) {
          updateDoc.draft = Boolean(newMetadata.draft);
          updateDoc.category = updateDoc.draft ? 'draft' : (newMetadata.category || oldPost.category || '').trim();
          updateDoc.categorySlug = updateDoc.draft ? 'draft' : slugify(updateDoc.category);
          updateDoc.metadata.category = updateDoc.category;
        }
        if (newMetadata.hidden !== undefined) updateDoc.hidden = Boolean(newMetadata.hidden);
      }

      updateDoc.updated_at = new Date();

      await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Successfully updated post "${title || oldPost.title}" (ID: ${id})`
              },
              null,
              2
            )
          }
        ]
      };
    }

    case 'delete_post': {
      const { id, scope } = args || {};
      if (!id) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Post ID is required.' }]
        };
      }

      if (id.startsWith('exodus:') || scope === 'exodus') {
        const delRes = await deleteExodusPost(id);
        if (!delRes.success) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Exodus file not found or could not be deleted.' }]
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Successfully deleted exodus post ID: ${id}` }, null, 2)
            }
          ]
        };
      }

      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Post not found.' }]
        };
      }

      const versionsCollection = db.collection('post_versions');
      await versionsCollection.deleteMany({ post_id: new ObjectId(id) });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Successfully deleted post ID: ${id} and its revision history.`
              },
              null,
              2
            )
          }
        ]
      };
    }

    case 'upload_image': {
      const postId = args?.post_id || args?.id || args?.postId || '';
      // Support both /admin/writer/mcp-upload and /writer/mcp-upload paths
      const widgetUrl = `${url.origin}/admin/writer/mcp-upload${postId ? '?id=' + postId : ''}`;

      return {
        content: [
          {
            type: 'text',
            text: 'Please use the Image Placement Widget below to upload and tag your images. Once you are done, let me know so I can proceed.'
          },
          {
            type: 'resource',
            resource: {
              uri: widgetUrl,
              mimeType: 'text/html;profile=mcp-app',
              text: `<html><body style="margin:0;padding:0;overflow:hidden;"><iframe src="${widgetUrl}" style="width:100%; height:550px; border:none; border-radius:12px;"></iframe></body></html>`
            }
          }
        ]
      };
    }

    case 'get_post_analytics': {
      const { id, slug } = args || {};
      let postId = id;
      if (!postId && slug) {
        const row = await collection.findOne({ slug });
        if (row) {
          postId = row._id.toString();
        }
      }
      if (!postId) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Post not found.' }]
        };
      }
      const data = await getPostAnalytics(postId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    }

    case 'get_general_analytics': {
      const { days } = args || {};
      const data = await getGeneralAnalytics(days || 30);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    }

    case 'outline': {
      const { topic } = args || {};
      return {
        content: [
          {
            type: 'text',
            text: `Guidelines retrieved successfully for topic: "${topic}".\n\n${styleGuidelines}`
          }
        ]
      };
    }

    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool "${name}" is not implemented.` }]
      };
  }
}
