import { Stack, type StackProps } from "@tamagui/core"
import { useRef, useLayoutEffect, useEffect, isValidElement, type CSSProperties } from "react"
import { Spring, useSpringValue, useTransition, easings, useMeasure, type SpringConfig } from "@aarock/ui-core"

export type RevealProps = StackProps & {
    config?: SpringConfig
}

export function Reveal ( {
    config = defaultConfig,
    children,
    ...rest
}: RevealProps ) {

    const isOpen = isValidElement( children )
    const childRef = useRef( children || null )

    const [ ref, { height = 0 } ] = useMeasure()
    const heightValue = useSpringValue( height )

    const transition = useTransition( isOpen, {
        from: { opacity: 0, height: 0 },
        enter: () => async next => {
            await next( { height: heightValue } )
            await next( { opacity: 1 } )
        },
        leave: () => async next => {
            await next( { opacity: 0 } )
            await next( { height: 0 } )
        },
        onDestroyed: ( item ) => {
            if ( item ) childRef.current = null
        },
        config
    } )

    useLayoutEffect( () => {
        heightValue.set( height )
    }, [ heightValue, height ] )

    useEffect( () => {
        if ( isValidElement( children ) ) {
            childRef.current = children
        }
    }, [ children ] )

    return transition( ( springs, item ) => item && <Spring style={ { ...outerStyle, ...springs } }>
        <Stack ref={ ref } style={ innerStyle } { ...rest }>
            { childRef.current || children }
        </Stack>
    </Spring> )

}

const outerStyle: CSSProperties = { position: "relative", }
const innerStyle: CSSProperties = { position: "absolute", left: 0, right: 0, top: 0, bottom: "auto", }
const defaultConfig: SpringConfig = { duration: 300, easing: easings.easeOutSine }
