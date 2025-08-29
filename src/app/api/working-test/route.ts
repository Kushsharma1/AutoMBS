export async function POST() {
  return new Response(JSON.stringify({ message: 'API WORKS!' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
