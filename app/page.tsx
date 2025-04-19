"use client"

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useState } from "react"
// import { useDebounce } from "@/hooks/use-debounce"

export default function Home() {
  const [input, setInput] = useState<string>('')
  const [searchResults, setSearchResults] = useState<{
    results: string[]
    duration: number
  }>()
  const [activeTab, setActiveTab] = useState<string>('redis')
  // const debounceInput = useDebounce(input, 300)

  useEffect(() => {
    const fetchData = async () => {
      if(!input.trim()) {
        setSearchResults(undefined)
        return
      }

      try {
        const res = await fetch(`https://difference-api.differenceapi.workers.dev/api/search?q=${encodeURIComponent(input.trim())}&engine=${activeTab}`)

        if(!res.ok) {
          setSearchResults(undefined)
          return
        }

        const data = (await res.json()) as {
          results: string[]
          duration: number
        }
        setSearchResults(data)

      } catch(err) {
        console.error(err)
      }
    }

    fetchData()
  }, [input, activeTab]) //whenever input, tab changes, this effect will run

  return (
    <main className="h-screen w-screen grainy">
      <div className="flex flex-col gap-6 items-center pt-32 duration-500 animate-in animate fade-in-5 slide-in-from-bottom-2.5">
        <h1 className="text-5xl font-bold tracking-tight">
          SpeedSearch⚡
        </h1>
        <p className="text-lg max-w-prose text-center text-zinc-600">
          A high-performance API built with Hono, Next.js and Cloudflare.
          <br />{' '}
          Type your query below and get results in milliseconds.
        </p>

        <div className="max-w-md w-full">
          <Command>
            <CommandInput value={input} onValueChange={setInput} placeholder="Search countries..." className="placeholder:text-zinc-500"/>
            <CommandList>
              {searchResults?.results.length === 0 ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : null}

              {searchResults?.results ? (
                <CommandGroup heading="Results">
                  {searchResults?.results.map((result) => (
                    <CommandItem key={result} value={result} onSelect={setInput}>{result}</CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {searchResults?.results ? (
                <>
                  <div className="h-px w-full bg-zinc-200" />
                  <p className="p-2 text-xs text-zinc-500">
                    Found {searchResults?.results.length} results in {searchResults?.duration.toFixed(0)}ms
                  </p>
                </>
              ) : null}
            </CommandList>
          </Command>
        </div>
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="text-center">
            <TabsList>
              <TabsTrigger value="postgreSQL">PostgreSQL</TabsTrigger>
              <TabsTrigger value="redis">Redis</TabsTrigger>
              {/* <TabsTrigger value="mongoDB">MongoDB</TabsTrigger> */}
            </TabsList>
            <TabsContent value="postgreSQL">Engine: PostgreSQL</TabsContent>
            <TabsContent value="redis">Engine: Redis</TabsContent>
            {/* <TabsContent value="mongoDB">Engine: MongoDB</TabsContent> */}
          </Tabs>
        </div>
      </div>
    </main>
  )
}
