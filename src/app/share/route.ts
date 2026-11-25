export function GET(request: Request) {
  return Response.redirect(new URL("/", request.url), 303);
}

export function POST(request: Request) {
  return Response.redirect(new URL("/?shared=missed", request.url), 303);
}
