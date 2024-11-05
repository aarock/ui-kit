import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { AnimatePresence, Box, Button, Portal, Text, XStack, XStackProps, YStack, YStackProps, useMeasure } from "@aarock/ui-core"

export type Toast = {
    key?: string
    icon?: string
    color?: string
    label?: string
    message?: string
    duration?: number
    adornments?: ReactNode | ReactNode[]
    onUndo?: () => void
    onRedo?: () => void
}

const ToastContext = createContext<( t: Toast ) => void>( () => { } )

export function useToast () { return useContext( ToastContext ) }

export function ToastProvider ( { children, ...rest }: YStackProps ) {

    const toastRef = useRef<Toast[]>( [] )
    const [ toasts, setToasts ] = useState( toastRef.current )
    const visibleToasts = toasts//.slice( -5 )//.reverse()

    const toast = useCallback( ( toast: Toast ) => {
        if ( !toast.key ) toast.key = "t" + Math.random()
        toastRef.current.push( toast )
        setToasts( [ ...toastRef.current ] )
    }, [] )

    const onDismiss = useCallback( ( toast: Toast ) => {
        toastRef.current = toastRef?.current?.filter( t => t.key !== toast.key )
        setToasts( [ ...toastRef.current ] )
    }, [] )

    return <ToastContext.Provider value={ toast } >
        { children }
        <Portal>
            <YStack
                p="$lg"
                position="absolute"
                pointerEvents="auto"
                alignItems="flex-end"
                zIndex={ 1000 }
                { ...rest }
            ><AnimatePresence>{ visibleToasts.map( ( toast, i ) =>
                <Toast id={ toast.key } key={ toast.key } toast={ toast } order={ i } onDismiss={ onDismiss } />
            ) }</AnimatePresence></YStack>
        </Portal >
    </ToastContext.Provider>

}

type ToastProps = XStackProps & {
    toast: Toast
    order: number
    onDismiss: ( toast: Toast ) => void
}

function Toast ( { toast, order, onDismiss, ...rest }: ToastProps ) {

    const [ ref, { height = 0 } ] = useMeasure()
    const [ isUndone, setUndone ] = useState(false)
    const [ stopwatch, setStopwatch ] = useState(0)

    useEffect( () => {
        const tid = setTimeout( () => onDismiss( toast ), (toast.duration || 10) * 1_000 )
        return () => { clearTimeout( tid ) }
    }, [ stopwatch ] )

    return <XStack
        key={ toast.key }
        zIndex={ order }
        position="relative"
        enterStyle={ { opacity: 0, height: 0 } }
        exitStyle={ { opacity: 0, height: 0 } }
        height={ height }
        animation="slow"
        { ...rest }
    >
        <Box>
            <Box ref={ ref }>
                <YStack
                    p="$sm"
                    mb="$sm"
                    mr="$sm"
                    gap="$sm"
                    bg="$neutral1"
                    borderWidth={ 1 }
                    borderRadius="$md"
                    borderColor="$neutral6"
                    shadowRadius="$lg"
                    shadowColor="$shadow3"
                    minWidth={ 300 }
                    maxWidth={ 340 }
                >

                    <XStack p="$sm" gap="$lg">

                        <XStack gap="$lg" alignItems="center" flexGrow={ 1 } flexShrink={ 1 }>

                            { toast.icon && <Button.Icon name={ toast.icon } color={ toast.color } /> }

                            <YStack flexShrink={ 1 } flexGrow={ 1 }>

                                { !!toast.label && <Text
                                    fontSize={ 14 }
                                    fontWeight="bold"
                                    overflow="hidden"
                                    whiteSpace="nowrap"
                                    textOverflow="ellipsis"
                                >{ toast.label }</Text> }

                                { !!toast.message && <Text fontSize={ 14 }>{ toast.message }</Text> }

                            </YStack>

                        </XStack>

                        <XStack alignItems="center" flexDirection="row-reverse">
                            { toast.adornments || <>
                              <Button size="$sm" variant="subtle" onPress={ () => onDismiss?.( toast ) }>
                                <Button.Icon name="cross" />
                              </Button>
                              { !!toast.onUndo && !isUndone && <Button size="$sm" variant="subtle" onPress={ () => {
                                toast.onUndo?.()
                                setUndone(true)
                                setStopwatch( new Date().getTime() )
                              } }>
                                <Button.Icon name="undo" />
                                <Button.Label children="Undo" />
                              </Button> }
                                { !!toast.onRedo && isUndone && <Button size="$sm" variant="subtle" onPress={ () => {
                                  toast.onRedo?.()
                                  setUndone(false)
                                  setStopwatch( new Date().getTime() )
                                } }>
                                <Button.Icon name="redo" />
                                <Button.Label children="Redo" />
                              </Button> }
                            </>}
                        </XStack>


                    </XStack>

                </YStack>
            </Box>
        </Box>
    </XStack>

}
