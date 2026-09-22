export default async function health() {
  return new Response(JSON.stringify({ service: 'tuturai-functions', status: 'ok' }), {
    headers: { 'content-type': 'application/json' },
  })
}
