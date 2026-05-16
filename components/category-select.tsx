'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CategorySelectProps {
  categories: { id: string; name: string }[]
}

export function CategorySelect({ categories }: CategorySelectProps) {
  const [value, setValue] = useState('')

  return (
    <div className="space-y-2">
      <Label htmlFor="category" className="text-foreground font-semibold">
        Subject / Category <span className="text-destructive">*</span>
      </Label>
      <input type="hidden" name="category_id" value={value} required />
      <Select value={value} onValueChange={setValue} required>
        <SelectTrigger id="category" className="bg-background/50 border-white/10 focus:ring-primary h-12">
          <SelectValue placeholder="Select a subject..." />
        </SelectTrigger>
        <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
          {categories.map((cat) => (
            <SelectItem
              key={cat.id}
              value={cat.id}
              className="cursor-pointer hover:bg-primary/10 hover:text-primary"
            >
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
