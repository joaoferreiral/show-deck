declare module '*.geojson' {
  const value: {
    type: string
    features: Array<{
      type: string
      properties: Record<string, string>
      geometry: {
        type: string
        coordinates: unknown
      }
    }>
  }
  export default value
}
