export default function ImageResultPreview({
    src,
    alt,
}: {
    src: string;
    alt: string;
}) {
    return (
        <div className="flex min-h-96 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-2">
            <img
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="max-h-[40rem] max-w-full object-contain"
            />
        </div>
    );
}
