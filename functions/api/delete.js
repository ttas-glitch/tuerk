export async function onRequestPost(context) {
  const { public_id, resource_type = 'image' } = await context.request.json();

  const cloudName = context.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = context.env.CLOUDINARY_API_KEY;
  const apiSecret = context.env.CLOUDINARY_API_SECRET;

  const timestamp = Math.floor(Date.now() / 1000);
  const str = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;

  const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const formData = new FormData();
  formData.append('public_id', public_id);
  formData.append('timestamp', String(timestamp));
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resource_type}/destroy`,
    { method: 'POST', body: formData }
  );

  const result = await res.json();
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
}
