import { DM_Sans, Sora, IBM_Plex_Mono } from 'next/font/google'

export const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
})

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})
