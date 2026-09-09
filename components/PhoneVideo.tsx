export function PhoneVideo({ url }: { url: string }) {
  return (
    <div className="relative mt-3 w-full max-w-[210px] overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-black shadow-lg">
      <video
        src={url}
        controls
        loop
        muted
        playsInline
        autoPlay
        className="aspect-[9/16] w-full bg-black object-cover"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <div className="mt-1.5 h-4 w-20 rounded-full bg-ink/90" />
      </div>
    </div>
  );
}
