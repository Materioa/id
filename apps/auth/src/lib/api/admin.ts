export async function makeAdminRequest(endpoint: string, method: string = 'GET', body?: any) {
  const token = localStorage.getItem('token') || localStorage.getItem('materio_auth_token');
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`
  };
  
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const options: RequestInit = {
    method,
    headers
  };

  if (body) {
    options.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`/api/v2/admin/${endpoint}`, options);
  if (!res.ok) {
    let errorData = { error: 'Unknown Error', message: '' };
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        errorData = await res.json();
      } else {
        const text = await res.text();
        errorData.message = `Server Error (${res.status}): ${text.substring(0, 100)}`;
      }
    } catch(e) {}
    
    const finalError = (errorData.error !== 'Unknown Error' ? errorData.error : null) 
      || errorData.message 
      || `API Error: ${res.status}`;
      
    throw new Error(finalError);
  }
  return res.json();
}
