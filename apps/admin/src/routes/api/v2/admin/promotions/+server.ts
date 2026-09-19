import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import { ObjectId } from 'mongodb';

async function checkAdmin(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return false;
  const decoded = await verifyToken(token);
  if (!decoded) return false;
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('has_admin_privileges')
    .eq('id', decoded.id)
    .single();
    
  return user?.has_admin_privileges === true;
}

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  const all = url.searchParams.get('all') === 'true';
  const db = await getDb();
  
  try {
    const query = all ? {} : { $or: [{ isActive: true }, { enabled: true }] };
    const promotions = await db.collection('promotions').find(query).sort({ createdAt: -1, lastUpdated: -1 }).toArray();
    
    // Map document to full schema matching promo.json with backward compatibility
    const mappedPromos = promotions.map(p => {
      const mediaList = Array.isArray(p.media) 
        ? p.media 
        : (p.imageUrl ? [p.imageUrl] : []);

      const primaryBtn = p.buttons?.primary || {};
      const secondaryBtn = p.buttons?.secondary || {};
      const disclaimerObj = p.disclaimer || {};

      const isPromoActive = p.enabled ?? p.isActive ?? false;

      return {
        id: p._id.toString(),
        title: p.title || '',
        description: p.description || p.body || '',
        category: p.category || 'whats-new',
        link: p.link || primaryBtn.url || p.buttonLink || '',
        frequency: p.frequency || 'daily',
        customFrequencyHours: String(p.customFrequencyHours ?? '0'),
        media: mediaList,
        mediaFit: p.mediaFit || 'scale-down',
        showImageOnMaintenance: !!p.showImageOnMaintenance,
        orientation: p.orientation || 'vertical',
        imageRotationInterval: Number(p.imageRotationInterval) || 2500,
        imageAnimation: {
          type: p.imageAnimation?.type || 'fade',
          duration: Number(p.imageAnimation?.duration) || 600
        },
        isLimitedOffer: !!p.isLimitedOffer,
        startDate: p.startDate || '',
        endDate: p.endDate || '',
        showDateInfo: !!p.showDateInfo,
        lastUpdated: p.lastUpdated || (p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString()),
        buttons: {
          primary: {
            show: primaryBtn.show ?? (primaryBtn.text || p.buttonText ? true : true),
            text: primaryBtn.text || p.buttonText || '',
            icon: primaryBtn.icon || p.buttonPrimaryIcon || '',
            url: primaryBtn.url || p.link || p.buttonLink || ''
          },
          secondary: {
            show: secondaryBtn.show ?? (secondaryBtn.text || p.buttonSecondaryText ? true : false),
            text: secondaryBtn.text || p.buttonSecondaryText || '',
            icon: secondaryBtn.icon || p.buttonSecondaryIcon || '',
            url: secondaryBtn.url || p.buttonSecondaryLink || ''
          }
        },
        disclaimer: {
          show: !!disclaimerObj.show,
          text: disclaimerObj.text || '',
          linkText: disclaimerObj.linkText || '',
          linkUrl: disclaimerObj.linkUrl || ''
        },
        // Flat convenience & fallback properties
        imageUrl: mediaList[0] || p.imageUrl || '',
        buttonText: primaryBtn.text || p.buttonText || '',
        buttonLink: primaryBtn.url || p.link || p.buttonLink || '',
        buttonPrimaryIcon: primaryBtn.icon || p.buttonPrimaryIcon || '',
        buttonSecondaryText: secondaryBtn.text || p.buttonSecondaryText || '',
        buttonSecondaryLink: secondaryBtn.url || p.buttonSecondaryLink || '',
        buttonSecondaryIcon: secondaryBtn.icon || p.buttonSecondaryIcon || '',
        isActive: isPromoActive,
        enabled: isPromoActive,
        createdAt: p.createdAt || p.lastUpdated || new Date().toISOString()
      };
    });
    return json({ promotions: mappedPromos });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const body = await request.json() as any;
    const db = await getDb();
    
    const isActivating = body.enabled ?? body.isActive ?? true;

    // If activating this one, deactivate others
    if (isActivating) {
      await db.collection('promotions').updateMany({}, { $set: { isActive: false, enabled: false } });
    }

    const primaryText = body.buttons?.primary?.text ?? body.buttonText ?? '';
    const primaryUrl = body.buttons?.primary?.url ?? body.buttonLink ?? body.link ?? '';
    const primaryIcon = body.buttons?.primary?.icon ?? body.buttonPrimaryIcon ?? '';
    const primaryShow = body.buttons?.primary?.show ?? (primaryText ? true : true);

    const secondaryText = body.buttons?.secondary?.text ?? body.buttonSecondaryText ?? '';
    const secondaryUrl = body.buttons?.secondary?.url ?? body.buttonSecondaryLink ?? '';
    const secondaryIcon = body.buttons?.secondary?.icon ?? body.buttonSecondaryIcon ?? '';
    const secondaryShow = body.buttons?.secondary?.show ?? (secondaryText ? true : false);

    let mediaList: string[] = [];
    if (Array.isArray(body.media)) {
      mediaList = body.media.filter(Boolean);
    } else if (body.media && typeof body.media === 'string') {
      mediaList = body.media.split('\n').map((m: string) => m.trim()).filter(Boolean);
    } else if (body.imageUrl) {
      mediaList = [body.imageUrl.trim()];
    }

    const promoDoc = {
      title: body.title || '',
      description: body.description || '',
      category: body.category || 'whats-new',
      link: body.link || primaryUrl,
      frequency: body.frequency || 'daily',
      customFrequencyHours: String(body.customFrequencyHours ?? '0'),
      media: mediaList,
      mediaFit: body.mediaFit || 'scale-down',
      showImageOnMaintenance: !!body.showImageOnMaintenance,
      orientation: body.orientation || 'vertical',
      imageRotationInterval: Number(body.imageRotationInterval) || 2500,
      imageAnimation: {
        type: body.imageAnimation?.type || 'fade',
        duration: Number(body.imageAnimation?.duration) || 600
      },
      isLimitedOffer: !!body.isLimitedOffer,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      showDateInfo: !!body.showDateInfo,
      buttons: { 
        primary: { 
          show: primaryShow,
          text: primaryText, 
          url: primaryUrl,
          icon: primaryIcon
        },
        secondary: {
          show: secondaryShow,
          text: secondaryText, 
          url: secondaryUrl,
          icon: secondaryIcon
        }
      },
      disclaimer: {
        show: !!body.disclaimer?.show,
        text: body.disclaimer?.text || '',
        linkText: body.disclaimer?.linkText || '',
        linkUrl: body.disclaimer?.linkUrl || ''
      },
      enabled: isActivating,
      isActive: isActivating,
      // Fallback flat fields
      buttonText: primaryText,
      buttonLink: primaryUrl,
      imageUrl: mediaList[0] || '',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    const result = await db.collection('promotions').insertOne(promoDoc);
    
    return json({ success: true, id: result.insertedId.toString() });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PUT({ request, params, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const body = await request.json() as any;
    const id = body.id || (params as any)?.id || url.searchParams.get('id');
    const db = await getDb();
    
    if (!id) return json({ error: 'ID is required' }, { status: 400 });

    const isActivating = body.enabled ?? body.isActive;
    if (isActivating === true) {
      await db.collection('promotions').updateMany({}, { $set: { isActive: false, enabled: false } });
    }
    
    const updateData: any = { ...body };
    if (isActivating !== undefined) {
      updateData.enabled = isActivating;
      updateData.isActive = isActivating;
    }

    const primaryText = body.buttons?.primary?.text ?? body.buttonText;
    const primaryUrl = body.buttons?.primary?.url ?? body.buttonLink ?? body.link;
    const primaryIcon = body.buttons?.primary?.icon ?? body.buttonPrimaryIcon;
    const primaryShow = body.buttons?.primary?.show;

    const secondaryText = body.buttons?.secondary?.text ?? body.buttonSecondaryText;
    const secondaryUrl = body.buttons?.secondary?.url ?? body.buttonSecondaryLink;
    const secondaryIcon = body.buttons?.secondary?.icon ?? body.buttonSecondaryIcon;
    const secondaryShow = body.buttons?.secondary?.show;

    if (primaryText !== undefined || secondaryText !== undefined || body.buttons !== undefined) {
      updateData.buttons = { 
        primary: { 
          text: primaryText || '', 
          url: primaryUrl || '',
          icon: primaryIcon || '',
          show: primaryShow !== undefined ? primaryShow : !!primaryText
        },
        secondary: { 
          text: secondaryText || '', 
          url: secondaryUrl || '',
          icon: secondaryIcon || '',
          show: secondaryShow !== undefined ? secondaryShow : !!secondaryText
        }
      };
      updateData.buttonText = primaryText || '';
      updateData.buttonLink = primaryUrl || '';
    }

    if (body.media !== undefined) {
      if (Array.isArray(body.media)) {
        updateData.media = body.media.filter(Boolean);
      } else if (typeof body.media === 'string') {
        updateData.media = body.media.split('\n').map((m: string) => m.trim()).filter(Boolean);
      }
      updateData.imageUrl = updateData.media[0] || '';
    } else if (body.imageUrl !== undefined) {
      updateData.media = body.imageUrl ? [body.imageUrl] : [];
      updateData.imageUrl = body.imageUrl;
    }

    if (body.description !== undefined) {
      updateData.body = body.description;
    }

    updateData.lastUpdated = new Date().toISOString();

    delete updateData.id;
    delete updateData._id;
    
    await db.collection('promotions').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE({ request, params, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const id = (params as any)?.id || url.searchParams.get('id');
    if (!id) return json({ error: 'ID is required' }, { status: 400 });
    
    const db = await getDb();
    await db.collection('promotions').deleteOne({ _id: new ObjectId(id) });
    
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
