import { NextRequest, NextResponse } from 'next/server'

export function GET(request: NextRequest) {
  return NextResponse.redirect(`${request.nextUrl.origin}/auth/login`)
}
