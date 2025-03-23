"use client"

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface StockData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface StockChartProps {
  data: StockData[]
  showCandlestick?: boolean
  width?: number
  height?: number
}

export function StockChart({ data, showCandlestick = false, width = 800, height = 400 }: StockChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 30, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Parse dates
    const parseDate = d3.timeParse("%Y-%m-%d")
    const formattedData = data.map(d => ({
      ...d,
      date: parseDate(d.date)!
    }))

    // Calculate price change for colors
    const priceChange = formattedData[formattedData.length - 1].close - formattedData[0].close
    const upColor = "rgb(34, 197, 94)"
    const downColor = "rgb(239, 68, 68)"
    const chartColor = priceChange >= 0 ? upColor : downColor

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(formattedData, d => d.date) as [Date, Date])
      .range([0, innerWidth])

    const y = d3.scaleLinear()
      .domain([
        d3.min(formattedData, d => Math.min(d.low, d.close))! * 0.995,
        d3.max(formattedData, d => Math.max(d.high, d.close))! * 1.005
      ])
      .range([innerHeight, 0])

    if (!showCandlestick) {
      // Add gradient for line chart
      const gradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", "area-gradient")
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", 0)
        .attr("y1", y(d3.min(formattedData, d => d.low)!))
        .attr("x2", 0)
        .attr("y2", y(d3.max(formattedData, d => d.high)!))

      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", chartColor)
        .attr("stop-opacity", 0.1)

      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", chartColor)
        .attr("stop-opacity", 0)

      // Area generator
      const area = d3.area<typeof formattedData[0]>()
        .x(d => x(d.date))
        .y0(innerHeight)
        .y1(d => y(d.close))

      // Line generator
      const line = d3.line<typeof formattedData[0]>()
        .x(d => x(d.date))
        .y(d => y(d.close))

      // Add the area path
      svg.append("path")
        .datum(formattedData)
        .attr("fill", "url(#area-gradient)")
        .attr("d", area)

      // Add the line path
      svg.append("path")
        .datum(formattedData)
        .attr("fill", "none")
        .attr("stroke", chartColor)
        .attr("stroke-width", 1.5)
        .attr("d", line)
    } else {
      // Draw candlesticks
      const candlestickWidth = Math.min(
        (innerWidth / formattedData.length) * 0.8,
        15
      )

      svg.selectAll("g.candlestick")
        .data(formattedData)
        .join("g")
        .attr("class", "candlestick")
        .each(function(d) {
          const g = d3.select(this)
          const isUp = d.close >= d.open

          // Draw the wick (high-low line)
          g.append("line")
            .attr("x1", x(d.date))
            .attr("x2", x(d.date))
            .attr("y1", y(d.high))
            .attr("y2", y(d.low))
            .attr("stroke", isUp ? upColor : downColor)
            .attr("stroke-width", 1)

          // Draw the body (open-close box)
          g.append("rect")
            .attr("x", x(d.date) - candlestickWidth / 2)
            .attr("y", y(Math.max(d.open, d.close)))
            .attr("width", candlestickWidth)
            .attr("height", Math.abs(y(d.open) - y(d.close)))
            .attr("fill", isUp ? upColor : downColor)
        })
    }

    // Add axes
    svg.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))

    svg.append("g")
      .call(d3.axisLeft(y))

    // Add tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "absolute hidden bg-background border border-border rounded-lg shadow-lg p-2 text-sm pointer-events-none")

    const formatDate = d3.timeFormat("%B %d, %Y")
    const formatPrice = (price: number) => `₹${price.toFixed(2)}`
    const formatVolume = (volume: number) => `${(volume / 1000000).toFixed(1)}M`

    // Add hover effects
    svg.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", () => tooltip.style("display", "block"))
      .on("mouseout", () => tooltip.style("display", "none"))
      .on("mousemove", (event) => {
        const bisect = d3.bisector((d: typeof formattedData[0]) => d.date).left
        const x0 = x.invert(d3.pointer(event)[0])
        const i = bisect(formattedData, x0, 1)
        const d = formattedData[i - 1]

        tooltip
          .html(`
            <div class="font-medium">${formatDate(d.date)}</div>
            <div>Open: ${formatPrice(d.open)}</div>
            <div>High: ${formatPrice(d.high)}</div>
            <div>Low: ${formatPrice(d.low)}</div>
            <div>Close: ${formatPrice(d.close)}</div>
            <div>Volume: ${formatVolume(d.volume)}</div>
          `)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px")
      })

    // Cleanup
    return () => {
      tooltip.remove()
    }
  }, [data, width, height, showCandlestick])

  return (
    <div className="w-full overflow-x-auto">
      <svg ref={svgRef} className="w-full" />
    </div>
  )
}