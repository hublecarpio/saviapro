import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to create SHA256 hash
async function sha256(message: string | Uint8Array): Promise<string> {
  const msgBuffer = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper for HMAC-SHA256 using Web Crypto API
async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

// AWS Signature V4
async function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: Uint8Array,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string
): Promise<Record<string, string>> {
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = datetime.slice(0, 8);
  
  const allHeaders = { ...headers, 'x-amz-date': datetime };
  const signedHeaderNames = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
  const canonicalHeaders = Object.entries(allHeaders)
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
    .sort()
    .join('\n') + '\n';
  
  const payloadHash = await sha256(body);
  
  const canonicalRequest = [
    method,
    url.pathname,
    url.search.slice(1),
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n');
  
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureBytes = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return {
    ...allHeaders,
    'x-amz-content-sha256': payloadHash,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const conversationId = formData.get('conversationId') as string;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Uploading file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    const endpoint = Deno.env.get('GLOBAL_S3_ENDPOINT') || '';
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') || '';
    const bucket = 'n8nback';
    const region = 'us-east-1';

    const arrayBuffer = await file.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);
    
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `chat-files/${userId}/${conversationId}/${timestamp}_${sanitizedFileName}`;

    const url = new URL(`${endpoint}/${bucket}/${key}`);
    
    const baseHeaders: Record<string, string> = {
      'Host': url.host,
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Length': body.length.toString(),
    };

    const signedHeaders = await signRequest(
      'PUT',
      url,
      baseHeaders,
      body,
      accessKeyId,
      secretAccessKey,
      region,
      's3'
    );

    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: signedHeaders,
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('S3 error response:', errorText);
      throw new Error(`S3 upload failed: ${response.status} - ${errorText}`);
    }

    const fileUrl = `${endpoint}/${bucket}/${key}`;
    console.log(`File uploaded successfully: ${fileUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: fileUrl,
        fileName: file.name 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error uploading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
