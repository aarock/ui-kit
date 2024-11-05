import { styled } from '@aarock/ui-core'
import { ColorProps } from './index.js'
import ColorPickerBase, { Panel1, Swatches, Preview, OpacitySlider, HueSlider } from 'reanimated-color-picker'

export const ColorPicker = styled( ColorPickerBase, {
    name: 'ColorPicker',
    display: "flex",
    borderRadius: 0,
    flexGrow: 1,
} as any ) as any

export function Color ( { value, hasAlpha, swatches, onValueChange, ...rest }: ColorProps ) {
    const hasSwatches = !!swatches?.length
    const onSelectColor = ( { hex } ) => {
        "worklet"
        onValueChange?.( hex )
    }
    return <ColorPicker
        value={ value }
        onComplete={ onSelectColor }
        { ...rest }
    >
        <Preview />
        <Panel1 />
        <HueSlider />
        { hasAlpha && <OpacitySlider /> }
        { hasSwatches && <Swatches colors={ swatches } /> }
    </ColorPicker>
}