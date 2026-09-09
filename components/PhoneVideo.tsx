export function PhoneVideo({ url }: { url: string }) {
  return (
    <div className="mt-3 w-full max-w-[210px] overflow-hidden rounded-[1.5rem] border-[3px] border-ink bg-black shadow-md">
      <video
        src={url}
        controls
        loop
        muted
        playsInline
        autoPlay
        className="aspect-[9/16] w-full bg-black object-cover"
      />
    </div>
  );
}
