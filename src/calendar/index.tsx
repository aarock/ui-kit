import { Button, Text, XStack, YStack, YStackProps } from "@aarock/ui-core"
import { useCallback, useMemo, useState } from "react"
import dayjs, { type Dayjs } from "dayjs"

export type CalendarMode = "month" | "date" | "time" | "zone"

export type CalendarProps<T> = YStackProps & CalendarPropOptions<T>

export type CalendarPropOptions<T> = {
    value?: T,
    onValueChange?: ( newValue: T ) => void
}

export function Calendar<T extends string | string[]> ( { value, onValueChange, ...rest }: CalendarProps<T> ) {

    const isRanged = useMemo( () => Array.isArray( value ), [ value ] )
    const dates = useMemo( () => Array.isArray( value ) ? value.map( dayjs ) : ( !!value ? [ dayjs( value ) ] : undefined ), [ value ] )
    const [ view, setView ] = useState( dates?.[ 0 ] || dayjs() )
    const [ mode, setMode ] = useState( "date" as CalendarMode )

    const onSelect = useCallback( ( d: Dayjs ) => {
        if ( !Array.isArray( value ) ) onValueChange?.( d.format() as T )
        else if ( !dates?.[ 0 ] || !!dates?.[ 1 ] ) onValueChange?.( [ d.format() ] as T )
        else if ( !dates?.[ 1 ] ) {
            const newDates = [ dates[ 0 ], d ].sort( ( a, b ) => a.diff( b ) )
            const newDateStrings = newDates.map( d => d.format() )
            onValueChange?.( newDateStrings as T )
        }
    }, [ isRanged, value ] )

    return <YStack minWidth={ 250 } gap="$lg" { ...rest }>

        { mode === "date" && <XStack alignItems="center" gap="$sm">
            <Button size="$sm" onPress={ () => setView( view.subtract( 1, 'month' ) ) }>
                <Button.Icon name="chevron-left" />
            </Button>
            <Button variant="subtle" size="$sm" flexGrow={ 1 } onPress={ () => setMode( "month" ) }>
                <Button.Icon name="date" />
                <Button.Label fontSize={ 14 } children={ view.format( "MMM YYYY" ) } />
            </Button>
            <Button size="$sm" onPress={ () => setView( view.add( 1, 'month' ) ) }>
                <Button.Icon name="chevron-right" />
            </Button>
        </XStack> }

        { mode === "month" && <XStack alignItems="center" gap="$sm">
            <Button size="$sm" onPress={ () => setView( view.subtract( 1, 'year' ) ) }>
                <Button.Icon name="chevron-left" />
            </Button>
            <Button variant="subtle" size="$sm" flexGrow={ 1 } onPress={ () => setMode( "date" ) }>
                <Button.Label fontSize={ 14 } children={ view.format( "YYYY" ) } />
            </Button>
            <Button size="$sm" onPress={ () => setView( view.add( 1, 'year' ) ) }>
                <Button.Icon name="chevron-right" />
            </Button>
        </XStack> }

        { mode === "time" && <XStack alignItems="center" gap="$sm">
            <Button variant="subtle" size="$sm" flexGrow={ 1 } onPress={ () => setMode( "date" ) }>
                <Button.Label fontSize={ 14 } children={ view.format( "D MMM YYYY" ) } />
            </Button>
        </XStack> }


        { mode === "date" && <DaysOfMonth dates={ dates } view={ view } onSelect={ onSelect } /> }
        { mode === "month" && <MonthsOfTheYear dates={ dates } view={ view } onViewChange={ v => { setView( v ); setMode( "date" ) } } /> }

        {/* <XStack justifyContent="space-between" gap="$sm">

            <Button size="$sm" px="$md" flexGrow={ 1 } onPress={ () => {
                console.log( dates?.[ 0 ] )
                setView( dates?.[ 0 ] || dayjs() )
                setMode( "time" )
            } }>
                <Button.Icon name="time" />
                <Button.Label>10:55:22 AM</Button.Label>
            </Button>

            <Button size="$sm" px="$md" onPress={ () => setMode( "zone" ) }>
                <Button.Icon name="zone" />
                <Button.Label>AEST</Button.Label>
            </Button>
            <Button variant="inverse" size="$sm">
                <Button.Icon name="check" />
            </Button>
        </XStack> */}

    </YStack>
}

type SubViewProps = {
    view?: Dayjs,
    dates?: Dayjs[],
    onSelect?: ( date: Dayjs ) => void
    onViewChange?: ( view: Dayjs ) => void
    // onValueChange?: ( dates: Dayjs[] ) => void
}


function DaysOfMonth ( { dates, view = dates?.[ 0 ], onSelect }: SubViewProps ) {
    const [ first, last = first ] = dates || []
    const firstViewDay = view?.startOf( 'month' )?.startOf( 'week' )
    const lastViewDay = view?.endOf( 'month' )?.endOf( 'week' )
    const weeksInView = ( lastViewDay?.diff( firstViewDay, 'weeks' ) || 0 ) + 1
    return <YStack gap="$sm">
        <XStack>{ Array( 7 ).fill( 0 ).map( ( _, j ) => {
            const today = firstViewDay?.add( j, 'days' )
            return <Text
                key={ today?.format() }
                fontSize={ 14 }
                color="$neutral9"
                children={ today?.format( "dd" ) }
                width={ 100 / 7 + "%" }
                textAlign="center"
            />
        } ) }
        </XStack>
        { Array( weeksInView ).fill( 0 ).map( ( _, i ) => {
            const thisWeek = firstViewDay?.add( i, 'weeks' )
            return <XStack
                key={ thisWeek?.format() }
                justifyContent="space-evenly"
            >{ Array( 7 ).fill( 0 ).map( ( _, j ) => {
                const today = thisWeek?.add( j, 'days' )
                const isFirst = !!first && today?.isSame( first, 'day' )
                const isLast = !!last && today?.isSame( last, 'day' )
                const isBetween = !!first && !!last && today?.isAfter( first ) && today?.isBefore( last )
                const isSelected = isFirst || isLast || isBetween
                const isThisMonth = !!view && today?.isSame( view, 'month' )
                return <Button
                    key={ today?.format() || "..." }
                    size="$sm"
                    width={ 100 / 7 + "%" }
                    height={ 40 }
                    variant={ isSelected ? "inverse" : "subtle" }

                    borderTopRightRadius={ isSelected && !isLast ? 0 : undefined }
                    borderBottomRightRadius={ isSelected && !isLast ? 0 : undefined }
                    borderRightWidth={ isSelected && !isLast ? 0 : undefined }

                    borderTopLeftRadius={ isSelected && !isFirst ? 0 : undefined }
                    borderBottomLeftRadius={ isSelected && !isFirst ? 0 : undefined }
                    borderLeftWidth={ isSelected && !isFirst ? 0 : undefined }
                    onPress={ () => today && onSelect?.( today ) }
                >
                    <Button.Label
                        children={ today?.date() || null }
                        color={ isThisMonth ? undefined : "$neutral7" }
                    />
                </Button>
            } ) || null }</XStack>
        } ) }</YStack>
}

function MonthsOfTheYear ( { dates, view = dates?.[ 0 ], onViewChange }: SubViewProps ) {
    const [ rows, cols ] = [ 4, 3 ]
    const firstViewMonth = view?.startOf( 'year' )
    return <YStack gap="$sm">
        { Array( rows ).fill( 0 ).map( ( _, i ) => {
            const thisQuarter = firstViewMonth?.add( i * cols, 'months' )
            return <XStack
                key={ thisQuarter?.format() }
                justifyContent="space-evenly"
            >{ Array( cols ).fill( 0 ).map( ( _, j ) => {
                const thisMonth = thisQuarter?.add( j, 'months' )
                return <Button
                    key={ thisMonth?.format() }
                    size="$sm"
                    width={ 100 / 3 + "%" }
                    height={ 58 }
                    variant={ "subtle" }
                    onPress={ () => thisMonth && onViewChange?.( thisMonth ) }
                ><Button.Label children={ thisMonth?.format( "MMM" ) } /></Button>
            } ) || null }</XStack>
        } ) }</YStack>
}