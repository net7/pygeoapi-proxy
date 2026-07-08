import { fromArrayBuffer } from 'geotiff';
import SLDParser from 'geostyler-sld-parser';

export type Rgba = [number, number, number, number];

export type ColorStop = {
    quantity: number;
    color: Rgba;
};

type SldRasterStyle = {
    colorStops: ColorStop[];
    rendering: 'color-map' | 'shaded-relief' | 'fallback';
    warning: string | null;
};

export type GeoTiffMapPreview = {
    canvas: HTMLCanvasElement;
    coordinates: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ];
    bounds: [number, number, number, number];
    styleWarning: string | null;
};

export async function buildGeoTiffMapPreview({
    geotiffBuffer,
    sldText,
    maxSize = 1024,
    signal,
}: {
    geotiffBuffer: ArrayBuffer;
    sldText: string;
    maxSize?: number;
    signal?: AbortSignal;
}): Promise<GeoTiffMapPreview> {
    const tiff = await fromArrayBuffer(geotiffBuffer, signal);
    const image = await tiff.getImage();
    const bounds = lngLatBoundsFromGeoTiffMetadata(
        image.getBoundingBox(),
        image.getGeoKeys() ?? {},
    );

    if (!bounds) {
        throw new Error('unsupported-bounds');
    }

    const size = scaledRasterSize(image.getWidth(), image.getHeight(), maxSize);
    const raster = await image.readRasters({
        samples: [0],
        width: size.width,
        height: size.height,
        resampleMethod: 'bilinear',
        signal,
    });

    const band = Array.isArray(raster) ? raster[0] : raster;
    const values = Array.from(band as ArrayLike<number>);
    const [minimum, maximum] = valueRange(values);
    const styleResult = await readSldRasterStyle(sldText);
    const colorStops =
        styleResult.colorStops.length > 0
            ? styleResult.colorStops
            : [
                  { quantity: minimum, color: [35, 55, 72, 255] as Rgba },
                  { quantity: maximum, color: [238, 232, 178, 255] as Rgba },
              ];

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('canvas-context-unavailable');
    }

    const imageData = context.createImageData(size.width, size.height);

    if (styleResult.rendering === 'shaded-relief') {
        paintShadedRelief(
            imageData.data,
            values,
            size.width,
            size.height,
            minimum,
            maximum,
        );
    } else {
        for (let index = 0; index < values.length; index += 1) {
            const color = Number.isFinite(values[index])
                ? colorForValue(values[index], colorStops)
                : ([0, 0, 0, 0] as Rgba);
            const offset = index * 4;

            imageData.data[offset] = color[0];
            imageData.data[offset + 1] = color[1];
            imageData.data[offset + 2] = color[2];
            imageData.data[offset + 3] = color[3];
        }
    }

    context.putImageData(imageData, 0, 0);

    const [west, south, east, north] = bounds;

    return {
        canvas,
        coordinates: [
            [west, north],
            [east, north],
            [east, south],
            [west, south],
        ],
        bounds,
        styleWarning: styleResult.warning,
    };
}

export function isLngLatBoundingBox(
    bounds: number[],
): bounds is [number, number, number, number] {
    if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) {
        return false;
    }

    const [west, south, east, north] = bounds;

    return (
        west >= -180 &&
        east <= 180 &&
        south >= -90 &&
        north <= 90 &&
        west < east &&
        south < north
    );
}

export function lngLatBoundsFromGeoTiffMetadata(
    bounds: number[],
    geoKeys: Record<string, unknown> = {},
): [number, number, number, number] | null {
    if (isLngLatBoundingBox(bounds)) {
        return bounds;
    }

    if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) {
        return null;
    }

    const utm = wgs84UtmZone(Number(geoKeys.ProjectedCSTypeGeoKey));

    if (!utm) {
        return null;
    }

    const [west, south, east, north] = bounds;
    const corners = [
        utmToLngLat(west, south, utm.zone, utm.northernHemisphere),
        utmToLngLat(west, north, utm.zone, utm.northernHemisphere),
        utmToLngLat(east, south, utm.zone, utm.northernHemisphere),
        utmToLngLat(east, north, utm.zone, utm.northernHemisphere),
    ];
    const longitudes = corners.map(([longitude]) => longitude);
    const latitudes = corners.map(([, latitude]) => latitude);
    const lngLatBounds: [number, number, number, number] = [
        Math.min(...longitudes),
        Math.min(...latitudes),
        Math.max(...longitudes),
        Math.max(...latitudes),
    ];

    return isLngLatBoundingBox(lngLatBounds) ? lngLatBounds : null;
}

export function scaledRasterSize(
    width: number,
    height: number,
    maxSize: number,
): { width: number; height: number } {
    const scale = Math.min(1, maxSize / Math.max(width, height));

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

export function colorStopsFromGeoStylerStyle(style: unknown): ColorStop[] {
    const rules = recordArray(propertyRecord(style, 'rules'));

    for (const rule of rules) {
        const symbolizers = recordArray(propertyRecord(rule, 'symbolizers'));

        for (const symbolizer of symbolizers) {
            if (symbolizer.kind !== 'Raster') {
                continue;
            }

            const colorMap = propertyRecord(symbolizer, 'colorMap');
            const entries = recordArray(
                propertyRecord(colorMap, 'colorMapEntries'),
            );
            const stops = entries
                .map((entry): ColorStop | null => {
                    const quantity = Number(entry.quantity);
                    const color = parseCssColor(String(entry.color ?? ''));
                    const alpha = alphaFromOpacity(entry.opacity);

                    if (!Number.isFinite(quantity) || !color) {
                        return null;
                    }

                    return {
                        quantity,
                        color: [color[0], color[1], color[2], alpha],
                    };
                })
                .filter((entry): entry is ColorStop => entry !== null)
                .sort((left, right) => left.quantity - right.quantity);

            if (stops.length > 0) {
                return stops;
            }
        }
    }

    return [];
}

export function colorForValue(value: number, stops: ColorStop[]): Rgba {
    if (stops.length === 0) {
        return [0, 0, 0, 0];
    }

    if (value <= stops[0].quantity) {
        return stops[0].color;
    }

    for (let index = 1; index < stops.length; index += 1) {
        const lower = stops[index - 1];
        const upper = stops[index];

        if (value <= upper.quantity) {
            const span = upper.quantity - lower.quantity || 1;
            const ratio = (value - lower.quantity) / span;

            return [
                interpolate(lower.color[0], upper.color[0], ratio),
                interpolate(lower.color[1], upper.color[1], ratio),
                interpolate(lower.color[2], upper.color[2], ratio),
                interpolate(lower.color[3], upper.color[3], ratio),
            ];
        }
    }

    return stops[stops.length - 1].color;
}

export function sldHasShadedRelief(sldText: string): boolean {
    return /<(?:[A-Za-z_][\w.-]*:)?ShadedRelief(?:\s|>|\/)/i.test(sldText);
}

async function readSldRasterStyle(sldText: string): Promise<SldRasterStyle> {
    const hasShadedRelief = sldHasShadedRelief(sldText);

    try {
        const parser = new SLDParser();
        const response = await parser.readStyle(sldText);
        const colorStops = colorStopsFromGeoStylerStyle(response.output);

        if (colorStops.length > 0) {
            return {
                colorStops,
                rendering: 'color-map',
                warning:
                    (response.errors?.length ?? 0) > 0
                        ? 'style-fallback'
                        : null,
            };
        }

        if (hasShadedRelief) {
            return { colorStops: [], rendering: 'shaded-relief', warning: null };
        }

        return {
            colorStops: [],
            rendering: 'fallback',
            warning: 'style-fallback',
        };
    } catch {
        if (hasShadedRelief) {
            return { colorStops: [], rendering: 'shaded-relief', warning: null };
        }

        return {
            colorStops: [],
            rendering: 'fallback',
            warning: 'style-fallback',
        };
    }
}

function valueRange(values: number[]): [number, number] {
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;

    for (const value of values) {
        if (!Number.isFinite(value)) {
            continue;
        }

        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
    }

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
        return [0, 1];
    }

    return minimum === maximum ? [minimum, minimum + 1] : [minimum, maximum];
}

function wgs84UtmZone(
    projectedCode: number,
): { zone: number; northernHemisphere: boolean } | null {
    if (!Number.isInteger(projectedCode)) {
        return null;
    }

    if (projectedCode >= 32601 && projectedCode <= 32660) {
        return {
            zone: projectedCode - 32600,
            northernHemisphere: true,
        };
    }

    if (projectedCode >= 32701 && projectedCode <= 32760) {
        return {
            zone: projectedCode - 32700,
            northernHemisphere: false,
        };
    }

    return null;
}

function utmToLngLat(
    easting: number,
    northing: number,
    zone: number,
    northernHemisphere: boolean,
): [number, number] {
    const semiMajorAxis = 6378137;
    const eccentricitySquared = 0.0066943799901413165;
    const eccentricityPrimeSquared =
        eccentricitySquared / (1 - eccentricitySquared);
    const scaleFactor = 0.9996;
    const x = easting - 500000;
    const y = northing - (northernHemisphere ? 0 : 10000000);
    const meridionalArc = y / scaleFactor;
    const mu =
        meridionalArc /
        (semiMajorAxis *
            (1 -
                eccentricitySquared / 4 -
                (3 * eccentricitySquared ** 2) / 64 -
                (5 * eccentricitySquared ** 3) / 256));
    const e1 =
        (1 - Math.sqrt(1 - eccentricitySquared)) /
        (1 + Math.sqrt(1 - eccentricitySquared));
    const footprintLatitude =
        mu +
        ((3 * e1) / 2) * Math.sin(2 * mu) +
        ((21 * e1 ** 2) / 16) * Math.sin(4 * mu) +
        ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
        ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
    const sinFootprint = Math.sin(footprintLatitude);
    const cosFootprint = Math.cos(footprintLatitude);
    const tanFootprint = Math.tan(footprintLatitude);
    const c1 = eccentricityPrimeSquared * cosFootprint ** 2;
    const t1 = tanFootprint ** 2;
    const n1 =
        semiMajorAxis /
        Math.sqrt(1 - eccentricitySquared * sinFootprint ** 2);
    const r1 =
        (semiMajorAxis * (1 - eccentricitySquared)) /
        (1 - eccentricitySquared * sinFootprint ** 2) ** 1.5;
    const d = x / (n1 * scaleFactor);
    const latitude =
        footprintLatitude -
        ((n1 * tanFootprint) / r1) *
            (d ** 2 / 2 -
                ((5 +
                    3 * t1 +
                    10 * c1 -
                    4 * c1 ** 2 -
                    9 * eccentricityPrimeSquared) *
                    d ** 4) /
                    24 +
                ((61 +
                    90 * t1 +
                    298 * c1 +
                    45 * t1 ** 2 -
                    252 * eccentricityPrimeSquared -
                    3 * c1 ** 2) *
                    d ** 6) /
                    720);
    const longitudeOrigin = degreesToRadians((zone - 1) * 6 - 180 + 3);
    const longitude =
        longitudeOrigin +
        (d -
            ((1 + 2 * t1 + c1) * d ** 3) / 6 +
            ((5 -
                2 * c1 +
                28 * t1 -
                3 * c1 ** 2 +
                8 * eccentricityPrimeSquared +
                24 * t1 ** 2) *
                d ** 5) /
                120) /
            cosFootprint;

    return [radiansToDegrees(longitude), radiansToDegrees(latitude)];
}

function paintShadedRelief(
    data: Uint8ClampedArray,
    values: number[],
    width: number,
    height: number,
    minimum: number,
    maximum: number,
): void {
    const span = maximum - minimum || 1;
    const normalizedValues = values.map((value) =>
        Number.isFinite(value) ? (value - minimum) / span : Number.NaN,
    );

    for (let index = 0; index < values.length; index += 1) {
        const offset = index * 4;

        if (!Number.isFinite(normalizedValues[index])) {
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
            data[offset + 3] = 0;
            continue;
        }

        const x = index % width;
        const y = Math.floor(index / width);
        const intensity = hillshadeIntensity(
            normalizedValues,
            width,
            height,
            x,
            y,
        );
        const shade = Math.round(35 + intensity * 220);

        data[offset] = shade;
        data[offset + 1] = shade;
        data[offset + 2] = shade;
        data[offset + 3] = 255;
    }
}

function hillshadeIntensity(
    values: number[],
    width: number,
    height: number,
    x: number,
    y: number,
): number {
    const center = sampleNormalized(values, width, height, x, y);
    const west = sampleNormalized(values, width, height, x - 1, y, center);
    const east = sampleNormalized(values, width, height, x + 1, y, center);
    const north = sampleNormalized(values, width, height, x, y - 1, center);
    const south = sampleNormalized(values, width, height, x, y + 1, center);
    const dzdx = east - west;
    const dzdy = south - north;
    const altitude = degreesToRadians(45);
    const azimuth = degreesToRadians(315);
    const slope = Math.atan(Math.sqrt(dzdx ** 2 + dzdy ** 2) * 10);
    const aspect = Math.atan2(dzdy, -dzdx);
    const intensity =
        Math.sin(altitude) * Math.cos(slope) +
        Math.cos(altitude) * Math.sin(slope) * Math.cos(azimuth - aspect);

    return clamp((intensity + 0.15) / 1.15, 0, 1);
}

function sampleNormalized(
    values: number[],
    width: number,
    height: number,
    x: number,
    y: number,
    fallback?: number,
): number {
    if (x < 0 || y < 0 || x >= width || y >= height) {
        return fallback ?? 0;
    }

    const value = values[y * width + x];

    return Number.isFinite(value) ? value : fallback ?? 0;
}

function degreesToRadians(value: number): number {
    return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
    return (value * 180) / Math.PI;
}

function propertyRecord(
    value: unknown,
    property: string,
): Record<string, unknown> | unknown[] | null {
    if (!isRecord(value)) {
        return null;
    }

    const propertyValue = value[property];

    if (isRecord(propertyValue) || Array.isArray(propertyValue)) {
        return propertyValue;
    }

    return null;
}

function recordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is Record<string, unknown> =>
              isRecord(entry),
          )
        : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseCssColor(color: string): Rgba | null {
    const hex = color.trim();

    if (/^#[0-9a-f]{3}$/i.test(hex)) {
        return [
            Number.parseInt(hex[1] + hex[1], 16),
            Number.parseInt(hex[2] + hex[2], 16),
            Number.parseInt(hex[3] + hex[3], 16),
            255,
        ];
    }

    if (/^#[0-9a-f]{6}$/i.test(hex)) {
        return [
            Number.parseInt(hex.slice(1, 3), 16),
            Number.parseInt(hex.slice(3, 5), 16),
            Number.parseInt(hex.slice(5, 7), 16),
            255,
        ];
    }

    return null;
}

function alphaFromOpacity(opacity: unknown): number {
    if (opacity === undefined || opacity === null || opacity === '') {
        return 255;
    }

    const parsedOpacity = Number(opacity);

    if (!Number.isFinite(parsedOpacity)) {
        return 255;
    }

    return Math.round(clamp(parsedOpacity, 0, 1) * 255);
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function interpolate(start: number, end: number, ratio: number): number {
    return Math.round(start + (end - start) * ratio);
}
