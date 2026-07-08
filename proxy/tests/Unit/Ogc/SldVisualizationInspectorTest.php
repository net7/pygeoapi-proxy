<?php

use App\Support\Ogc\SldVisualizationInspector;

test('it warns for hillshade only raster styles', function () {
    $warning = app(SldVisualizationInspector::class)->warningForXml(<<<'XML'
        <?xml version="1.0" encoding="UTF-8"?>
        <StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
            <NamedLayer>
                <UserStyle>
                    <FeatureTypeStyle>
                        <Rule>
                            <RasterSymbolizer>
                                <ShadedRelief />
                            </RasterSymbolizer>
                        </Rule>
                    </FeatureTypeStyle>
                </UserStyle>
            </NamedLayer>
        </StyledLayerDescriptor>
        XML);

    expect($warning)->toBe(SldVisualizationInspector::HillshadeWithoutColorMap);
});

test('it does not warn for color mapped raster styles', function () {
    $warning = app(SldVisualizationInspector::class)->warningForXml(<<<'XML'
        <?xml version="1.0" encoding="UTF-8"?>
        <StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
            <NamedLayer>
                <UserStyle>
                    <FeatureTypeStyle>
                        <Rule>
                            <RasterSymbolizer>
                                <ColorMap>
                                    <ColorMapEntry color="#000000" quantity="0" opacity="0.0" />
                                    <ColorMapEntry color="#DC3220" quantity="1" opacity="0.60" />
                                </ColorMap>
                            </RasterSymbolizer>
                        </Rule>
                    </FeatureTypeStyle>
                </UserStyle>
            </NamedLayer>
        </StyledLayerDescriptor>
        XML);

    expect($warning)->toBeNull();
});

test('it does not warn for contrast enhanced hillshade styles', function () {
    $warning = app(SldVisualizationInspector::class)->warningForXml(<<<'XML'
        <?xml version="1.0" encoding="UTF-8"?>
        <StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
            <NamedLayer>
                <UserStyle>
                    <FeatureTypeStyle>
                        <Rule>
                            <RasterSymbolizer>
                                <ContrastEnhancement>
                                    <Normalize />
                                </ContrastEnhancement>
                                <ShadedRelief />
                            </RasterSymbolizer>
                        </Rule>
                    </FeatureTypeStyle>
                </UserStyle>
            </NamedLayer>
        </StyledLayerDescriptor>
        XML);

    expect($warning)->toBeNull();
});
