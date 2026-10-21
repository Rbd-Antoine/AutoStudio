'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const SLIDES = [
  '/scroll-car-1.jpeg',
  '/scroll-car-2.jpeg',
  '/scroll-car-3.jpeg',
  '/scroll-car-4.jpeg',
  '/scroll-car-5.jpeg',
  '/scroll-car-6.jpeg',
]

export function AuthVisualCarousel() {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 4500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="absolute inset-0">
      {SLIDES.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt="Rendu de véhicule généré par AutoStudio"
          fill
          priority={i === 0}
          className={cn(
            'object-cover transition-opacity duration-1000 ease-in-out',
            i === current ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
    </div>
  )
}
