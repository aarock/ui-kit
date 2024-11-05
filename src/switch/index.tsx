import { Button, XStack, XStackProps, useMeasure } from "@aarock/ui-core"

const BUTTON_WIDTH = 22

export type SwitchProps = XStackProps & {
    value?: boolean
    onValueChange?: ( newValue: boolean ) => void
    onLabel?: string
    offLabel?: string
}

export function Switch ( {
    value,
    onValueChange,
    onLabel = "ON",
    offLabel = "OFF",
    ...rest
}: SwitchProps ) {

    const [ refL, { width: wl = 0 } ] = useMeasure()
    const [ refR, { width: wr = 0 } ] = useMeasure()
    const maxLabelWidth = Math.max( wl, wr )
    const width = Math.max( wl, wr ) + BUTTON_WIDTH

    return <XStack
        p="$sm"
        gap="$md"
        cursor="pointer"
        opacity={ maxLabelWidth ? 1 : 0 }
        borderRadius={ 100 }
        backgroundColor={ value ? "$primary9" : "$neutral3" }
        animation="slow" animateOnly={ [ "backgroundColor" ] }
        alignSelf="flex-start"
        alignItems="center"
        onPressIn={ () => onValueChange?.( !value ) }
        hitSlop={ 60 }
        { ...rest }
    >

        <XStack
            width={ width }
            minWidth={ width }
            minHeight={ BUTTON_WIDTH }
        >

            <XStack position="absolute" top={ 0 } bottom={ 0 } left={ 0 } minWidth={ maxLabelWidth } alignItems="center" justifyContent="center">
                <Button.Label ref={ refL } fontWeight="bold" px="$sm" color="$primary1" animation="fast" animateOnly={ [ "opacity" ] } size="$sm" opacity={ value ? 1 : 0 } children={ onLabel } />
            </XStack>


            <XStack position="absolute" top={ 0 } bottom={ 0 } right={ 0 } minWidth={ maxLabelWidth } alignItems="center" justifyContent="center">
                <Button.Label ref={ refR } fontWeight="normal" px="$sm" color="$neutral11" animation="fast" animateOnly={ [ "opacity" ] } size="$sm" opacity={ !value ? 1 : 0 } children={ offLabel } />
            </XStack>

            <Button
                size="$sm"
                width={ BUTTON_WIDTH }
                borderRadius={ 100 }
                position="absolute"
                top={ 0 } bottom={ 0 } left={ 0 }
                transform={ [ { translateX: value ? maxLabelWidth : 0 } ] }
                // left={ value ? maxLabelWidth : 0 }
                animateOnly={ [ "transform" ] }
                animation="fast"
            >{/* <Button.Icon name="drag-h" color="$neutral4" /> */ }</Button>
        </XStack>

    </XStack>
}