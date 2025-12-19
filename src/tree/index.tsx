import { ReactNode, useCallback, useEffect, useRef, useState, Ref, useImperativeHandle, useMemo, DependencyList } from "react"
import { List, RowComponentProps } from 'react-window'
import { Box, XStack } from "@aarock/ui-core"

export const ROOT_KEY = "__ROOT__"

export type EdgeState = {
    total?: number
    offset: number
    limit: number
    cursor: string | null
    loading: boolean
    complete: boolean
}

export type TreeActions<B, L = B> = {
    insertBranch: ( branch: B, parent?: B | null ) => void
    deleteBranch: ( branch: B, parent?: B | null ) => void
    updateBranch: ( branch: B, parent?: B | null ) => void
    insertLeaf: ( leaf: L, branch?: B | null ) => void
    deleteLeaf: ( leaf: L, branch?: B | null ) => void
    updateLeaf: ( leaf: L, branch?: B | null ) => void
    // reloadTree: () => void
}

export type EdgeActions = {
    setOffset: ( offset: number ) => void
    setLimit: ( limit: number ) => void
    setTotal: ( total: number ) => void
    setCursor: ( cursor: string | null ) => void
    setComplete: ( cursor: boolean ) => void
}

export type NodeState = {
    depth: number
    hasParent: boolean
    isExpanded: boolean
    isFirst: boolean
    isLast: boolean
    globalIndex: number,
    localIndex: number,
    hasBranches: boolean
    hasLeaves: boolean
}

export type NodeActions = {
    expand: () => void
    collapse: () => void
    toggle: () => void
}

export type Node<B, L = B> = {
    key?: string
    branch?: B
    parents?: B[]
    branches?: B[]
    // branchesTotal?: number
    // branchesOffset?: number
    // branchesLimit?: number
    // branchesCursor?: string | null
    leaf?: L
    leaves?: L[]
    // leavesTotal?: number
    // leavesOffset?: number
    // leavesLimit?: number
    // hasParent?: boolean
    isExpanded?: boolean
    isFirst?: boolean
    isLast?: boolean
    index: number,
    hasBranches?: boolean
    hasLeaves?: boolean
}

export type TreeProps<B = any, L = B> = {
    // Wrapper?: ElementType
    branchType?: B
    leafType?: L
    actions?: Ref<TreeActions<B, L>>
    filterKey?: string
    leafHeight?: number,
    branchHeight?: number,
    isFlat?: boolean,
    accessBranches?: ( branch: B | null, options: EdgeState & EdgeActions ) => ( B[] | Promise<B[]> )
    accessLeaves?: ( branch: B | null, options: EdgeState & EdgeActions ) => ( L[] | Promise<L[]> )
    sortBranches?: ( a: B, b: B ) => number,
    sortLeaves?: ( a: L, b: L ) => number,
    filterBranches?: ( b: B ) => boolean,
    filterLeaves?: ( a: L ) => boolean,
    accessBranchKey?: ( branch: B ) => string
    accessLeafKey?: ( leaf: L ) => string
    renderBranch?: ( branch: B, options: NodeState & NodeActions ) => ReactNode
    renderLeaf?: ( leaf: L, options: NodeState & NodeActions ) => ReactNode
    onMeasure?: ( size: { width: number, height: number } ) => void
    deps?: DependencyList
}

export function Tree<B = any, L = B> ( {
    isFlat = false,
    leafHeight = 42,
    branchHeight = 42,
    accessBranches = () => [] as B[],
    accessLeaves = () => [] as L[],
    accessBranchKey = ( branch: any ) => branch?.id || "",
    accessLeafKey = ( leaf: any ) => leaf?.id || "",
    sortBranches,
    sortLeaves,
    filterKey,
    filterBranches,
    filterLeaves,
    renderBranch,
    renderLeaf,
    onMeasure,
    actions,
    deps = [],
}: TreeProps<B, L> ) {

    // const rootKey = ( root && accessBranchKey( root ) ) || ROOT_KEY
    const branchesByParentKey = useRef<Map<string, B[]>>( new Map() )
    const leavesByParentKey = useRef<Map<string, L[]>>( new Map() )
    const branchStateByParentKey = useRef<Map<string, EdgeState>>( new Map() )
    const leafStateByParentKey = useRef<Map<string, EdgeState>>( new Map() )
    const expandedBranchesByKey = useRef<Map<string, B>>( new Map() )
    const branchesByKey = useRef<Map<string, B>>( new Map() )

    const [ expanded, setExpanded ] = useState<Set<string>>( new Set( [] ) )
    const [ incomplete, setIncomplete ] = useState<B[]>( [] )
    const [ flattened, setFlattened ] = useState<Node<B, L>[]>( [] )

    const insertBranch = useCallback( ( branch: B, parent?: B | null, wait?: boolean ) => {
        const branchKey = accessBranchKey( branch )
        const parentKey = parent ? accessBranchKey( parent ) : ROOT_KEY
        const branches = branchesByParentKey.current.get( parentKey )?.filter( b => accessBranchKey( b ) !== branchKey ).concat( branch ) || [ branch ]
        if ( branches && sortBranches ) branches.sort( sortBranches )
        branchesByKey.current.set( branchKey, branch )
        branchesByParentKey.current.set( parentKey, branches )
        console.log( "inserting branch", branchKey, "into", parentKey, branches )
        if ( !wait ) setFlattened( flatten() )
    }, [] )

    const deleteBranch = useCallback( ( branch: B, parent?: B | null, wait?: boolean ) => {
        const branchKey = accessBranchKey( branch )
        const parentKey = parent ? accessBranchKey( parent ) : ROOT_KEY
        const oldParent = branchesByKey.current.get( parentKey ) || parent
        const branches = branchesByParentKey.current.get( parentKey )?.filter( l => accessBranchKey( l ) !== accessBranchKey( branch ) ) || []
        // branchesByKey.current.delete( branchKey )
        branchesByParentKey.current.set( parentKey, branches )
        console.log( "deleting branch", branchKey, "from", parentKey, branches )
        if ( !wait ) setFlattened( flatten( oldParent ) )
    }, [] )

    const updateBranch = useCallback( ( branch: B, parent?: B | null, wait?: boolean ) => {

        let fields: B | undefined = undefined
        const branchKey = accessBranchKey( branch )
        const newParentKey = parent ? accessBranchKey( parent ) : ROOT_KEY
        const newParent = branchesByKey.current.get( newParentKey )

        for ( let [ oldParentKey, branches ] of branchesByParentKey.current ) {
            const oldBranch = branches?.find( b => accessBranchKey( b ) === accessBranchKey( branch ) )
            const oldParent = branchesByKey.current.get( oldParentKey )
            if ( !!oldBranch ) fields = { ...fields || {}, ...oldBranch }
            if ( !!oldBranch ) console.log( "updating branch", branchKey, "from", oldParentKey, "to", newParentKey, wait )
            if ( !!oldBranch ) deleteBranch( branch, oldParent, true )
        }

        if ( !!fields ) insertBranch( { ...fields, ...branch }, newParent )

    }, [] )

    const insertLeaf = useCallback( ( leaf: L, branch?: B | null, wait?: boolean ) => {
        const leafKey = accessLeafKey( leaf )
        const branchKey = branch ? accessBranchKey( branch ) : ROOT_KEY
        const leaves = leavesByParentKey.current.get( branchKey )
            ?.filter( l => accessLeafKey( l ) !== leafKey )
            ?.concat( leaf )
            || [ leaf ]
        if ( leaves && sortLeaves ) leaves.sort( sortLeaves )
        leavesByParentKey.current.set( branchKey, leaves )
        console.log( "inserting leaf", leafKey, "into", branchKey, leaves, wait )
        if ( !wait ) setFlattened( flatten() )
    }, [] )

    const deleteLeaf = useCallback( ( leaf: L, _branch?: B | null, wait?: boolean ) => {
        const leafKey = accessLeafKey( leaf )
        for ( let [ oldBranchKey, leaves ] of leavesByParentKey.current ) {
            const oldLeaf = leaves?.find( l => accessLeafKey( l ) === leafKey )
            if ( oldLeaf ) {
                const newLeaves = leavesByParentKey.current.get( oldBranchKey )?.filter( l => accessLeafKey( l ) !== leafKey ) || []
                console.log( "deleting leaf", leafKey, "from", oldBranchKey, newLeaves, wait )
                leavesByParentKey.current?.set( oldBranchKey, newLeaves )
            }
        }
        if ( !wait ) setFlattened( flatten() )
    }, [] )

    const updateLeaf = useCallback( ( leaf: L, branch?: B | null, wait?: boolean ) => {

        const leafKey = accessLeafKey( leaf )
        const newBranchKey = branch ? accessBranchKey( branch ) : ROOT_KEY
        const newBranch = branchesByKey.current.get( newBranchKey )
        let oldBranch = branchesByKey.current.get( ROOT_KEY )
        let fields: L | undefined = undefined

        for ( let [ oldBranchKey, leaves ] of leavesByParentKey.current ) {
            const oldLeaf = leaves?.find( l => accessLeafKey( l ) === leafKey )
            if ( !oldLeaf ) continue
            fields = oldLeaf
            oldBranch = branchesByKey.current.get( oldBranchKey )
            deleteLeaf( leaf, oldBranch, true )
        }

        if ( !!fields ) insertLeaf( { ...fields, ...leaf }, branch === undefined ? oldBranch : newBranch )

    }, [] )

    useImperativeHandle( actions, () => ( {
        insertBranch,
        deleteBranch,
        updateBranch,
        insertLeaf,
        deleteLeaf,
        updateLeaf,
    } ), [] )

    // takes a branch of a tree and flattens out all sub-branches and sub-leaves
    // into an array of nodes for rendering. returns the flattened array.
    const flatten = useCallback( ( branch?: B | null, parents?: B[], state?: Partial<Node<B, L>> ): Node<B, L>[] => {

        const isRoot = !branch
        const branchKey = branch ? accessBranchKey( branch ) : ROOT_KEY
        const parentBranches = parents || [] as B[]
        const parentBranch = parentBranches[ parentBranches.length - 1 ] || undefined
        const parentBranchKey = parentBranch ? accessBranchKey( parentBranch ) : undefined
        const isExpanded = isRoot || expandedBranchesByKey.current.has( branchKey )

        let subBranches = ( isExpanded && branchesByParentKey.current.get( branchKey ) ) || [] as B[]
        let subLeaves = ( isExpanded && leavesByParentKey.current.get( branchKey ) ) || [] as L[]

        if ( filterBranches ) subBranches = subBranches.filter( filterBranches )
        if ( filterLeaves ) subLeaves = subLeaves.filter( filterLeaves )

        // const hasMoreBranches = !branchStateByParentKey.current.get( branchKey )?.complete
        const hasMoreLeaves = !leafStateByParentKey.current.get( branchKey )?.complete
        const parentsIncludingCurrent = [ ...parentBranches, ...branch ? [ branch ] : [] ]
        return [
            ...isRoot ? [] : [ {
                index: 0,
                key: parentBranchKey,
                parents: parentBranches,
                branch,
                ...state
            } ],
            ...isFlat ? [] : subBranches.map( ( subBranch, i ) => flatten( subBranch, parentsIncludingCurrent, {
                index: i,
                isFirst: i === 0,
                isLast: i === subBranches.length - 1,
                hasBranches: true,
                hasLeaves: !!subBranches.length
            } ) ).flat(),
            ...subLeaves.map( ( leaf, i ) => ( {
                parents: parentsIncludingCurrent,
                key: branchKey, leaf,
                index: i,
                isFirst: i === 0,
                isLast: i === subLeaves.length - 1,
                hasMore: hasMoreLeaves,
                hasParent: !isRoot,
                hasLeaves: true,
                hasBranches: !!subBranches.length
            } ) ),
        ]
    }, [ expanded, filterKey, isFlat ] )

    // given a branch of a tree, re-fetches and chaches all sub-branches and sub-leaves
    // that have not already been marked as completed. does a comparison of results before
    // merging.
    const loadMore = useCallback( async ( parent: B | null = null ) => {

        const branchKey = parent ? accessBranchKey( parent ) : ROOT_KEY
        const defaultState = { cursor: null, total: undefined, offset: 0, limit: 1000, loading: false, complete: false }
        const isRoot = !parent || branchKey === ROOT_KEY

        if ( !branchStateByParentKey?.current?.has( branchKey ) ) branchStateByParentKey?.current?.set( branchKey, defaultState )
        if ( !leafStateByParentKey?.current?.has( branchKey ) ) leafStateByParentKey?.current?.set( branchKey, defaultState )
        if ( !branchesByParentKey?.current?.has( branchKey ) ) branchesByParentKey?.current?.set( branchKey, [] )
        if ( !leavesByParentKey?.current?.has( branchKey ) ) leavesByParentKey?.current?.set( branchKey, [] )

        const branchState = branchStateByParentKey.current.get( branchKey ) || defaultState
        const leafState = leafStateByParentKey.current.get( branchKey ) || defaultState

        const branchOptions: EdgeState & EdgeActions = {
            ...defaultState,
            ...branchState,
            setCursor: ( cursor: string | null ) => branchState.cursor = cursor,
            setTotal: ( total: number ) => branchState.total = total,
            setOffset: ( offset: number ) => branchState.offset = offset,
            setLimit: ( limit: number ) => branchState.limit = limit,
            setComplete: ( complete: boolean ) => branchState.complete = complete,
        }

        const leafOptions: EdgeState & EdgeActions = {
            ...defaultState,
            ...leafState,
            setCursor: ( cursor: string | null ) => leafState.cursor = cursor,
            setTotal: ( total: number ) => leafState.total = total,
            setOffset: ( offset: number ) => leafState.offset = offset,
            setLimit: ( limit: number ) => leafState.limit = limit,
            setComplete: ( complete: boolean ) => leafState.complete = complete,
        }

        const isExpanded = isRoot || expanded.has( branchKey )
        const shouldFetchBranches = !branchState.complete && !branchState.loading && !isFlat
        const shouldFetchLeaves = !leafState.complete && !leafState.loading && isExpanded

        if ( branchStateByParentKey?.current ) branchStateByParentKey.current.get( branchKey )!.loading = true
        if ( leafStateByParentKey?.current ) leafStateByParentKey.current.get( branchKey )!.loading = true

        return Promise.all( [
            shouldFetchBranches ? Promise.resolve( accessBranches?.( parent, branchOptions ) || [] ) : Promise.resolve( [] ),
            shouldFetchLeaves ? Promise.resolve( accessLeaves?.( parent, leafOptions ) || [] ) : Promise.resolve( [] ),
        ] ).then( ( [ branches, leaves ] ) => {

            let numBranchesUpdated = 0
            let numLeavesUpdated = 0

            if ( shouldFetchBranches && branches.length ) {
                branchStateByParentKey.current.get( branchKey )!.loading = false
                const existingBranches = branchesByParentKey.current.get( branchKey )!
                branches.forEach( branch => {
                    const existingIndex = existingBranches.findIndex( existing => accessBranchKey( existing ) === accessBranchKey( branch ) )
                    if ( existingIndex === -1 ) branchesByKey.current.set( accessBranchKey( branch ), branch )
                    if ( existingIndex === -1 ) numBranchesUpdated++
                    if ( existingIndex !== -1 ) existingBranches[ existingIndex ] = branch
                    else existingBranches.push( branch )
                } )
            }

            if ( shouldFetchLeaves && leaves.length ) {
                leafStateByParentKey.current.get( branchKey )!.loading = false
                const existingLeaves = leavesByParentKey.current.get( branchKey )!
                leaves.forEach( leaf => {
                    const existingIndex = existingLeaves.findIndex( existing => accessLeafKey( existing ) === accessLeafKey( leaf ) )
                    if ( existingIndex === -1 ) numLeavesUpdated++
                    if ( existingIndex !== -1 ) existingLeaves[ existingIndex ] = leaf
                    else existingLeaves.push( leaf )
                } )
            }

            if ( !numBranchesUpdated && branchStateByParentKey?.current ) branchStateByParentKey.current.get( branchKey )!.complete = true
            if ( !numLeavesUpdated && leafStateByParentKey?.current ) leafStateByParentKey.current.get( branchKey )!.complete = true

        } )

    }, [ expanded ] )

    // kick things off by initiating the loadMore from the root
    useEffect( () => {
        loadMore( null ).then( () => {
            const newFlattened = flatten()
            setFlattened( newFlattened )
        } )
    }, [] )

    // whenever filter key changes, re-flatten the tree
    useEffect( () => {
        setFlattened( flatten() )
    }, [ filterKey ] )

    // whenever folders open, load the folder
    useEffect( () => {
        Promise.all( [ ...expanded ].map( key => {
            const branch = expandedBranchesByKey.current?.get( key )
            if ( branch ) return loadMore( branch )
            return Promise.resolve()
        } ) ).then( () => setFlattened( flatten() ) )
    }, [ expanded ] )

    // whenever incompletes change.. load them
    useEffect( () => {
        Promise.all( incomplete.map( branch => {
            if ( branch ) return loadMore( branch )
            return Promise.resolve()
        } ) ).then( () => setFlattened( flatten() ) )
    }, [ incomplete ] )

    const sizeRef = useRef<HTMLElement>( null )
    const [ { width, height }, setSize ] = useState( { width: 0, height: 0 } )
    // const [ height, setHeight ] = useState( 0 )

    // whenever the list becomes flattened measure the 
    useEffect( () => {
        const height = flattened?.length * leafHeight
        if ( height ) onMeasure?.( { width, height } )
    }, [ flattened?.length, width, leafHeight ] )

    useEffect( () => {
        if ( !sizeRef.current ) return
        const updateSize = () => setSize( sizeRef.current?.getBoundingClientRect() || { width: 0, height: 0 } )
        const observer = new ResizeObserver( entries => entries.forEach( updateSize ) )
        observer.observe( sizeRef.current )
        updateSize()
        setSize( sizeRef.current?.getBoundingClientRect() || { width: 0, height: 0 } )
        return () => { observer.disconnect() }
    }, [] )

    return useMemo( () => <Box ref={ sizeRef }><List
        rowComponent={ Row }
        rowProps={ {
            flattened, expanded, setExpanded,
            accessLeafKey, accessBranchKey, renderLeaf, renderBranch,
            leafStateByParentKey, expandedBranchesByKey, branchStateByParentKey
        } }
        rowCount={ flattened.length }
        rowHeight={ ( row, props ) => rowHeight( row, { branchHeight, leafHeight, ...props } ) }
        onRowsRendered={ ( { startIndex, stopIndex } ) => {

            const viewableNodes = flattened.slice( startIndex, stopIndex )

            const lastEntryParentKeys = viewableNodes
                .filter( ( { isLast } ) => isLast )
                .map( ( { key } ) => key as string )
                .filter( Boolean )

            const incompleteParents = [ ...new Set( lastEntryParentKeys ) ]
                .map( key => branchesByKey.current.get( key as string ) as B )
                .filter( Boolean )

            setIncomplete( incompleteParents )

        } }

    /></Box>,[ JSON.stringify( flattened ), [ ...expanded ].join( ":" ), ...deps ] )

}

export type StemProps = {
    depth?: number
    color?: string
    isFirst?: boolean
    isLast?: boolean
    width?: number
    reachY?: number
}

export function Stem ( {
    depth = 0,
    color = "muted",
    isFirst,
    isLast,
    width = 32,
    reachY = 0
}: StemProps ) {

    return Array( depth ).fill( 0 ).map( ( _, i ) => <XStack
        key={ "dpth-" + i }
        position="relative"
        width={ width }
        height="100%"
    >{ i === depth - 1 ?
        <Box>
            <XStack position="absolute"
                top={ -reachY }
                // top={ isFirst ? -reachY : 0 }
                right={ 0 }
                bottom={ isLast ? "50%" : 0 }
                left="50%"
                borderLeftWidth={ 1 }
                borderBottomWidth={ isLast ? 1 : 0 }
                borderBottomLeftRadius={ isLast ? "sm" : 0 }
                borderColor={ color }
            />
            { !isLast && <XStack position="absolute"
                top={ 0 }
                right={ 0 }
                bottom="50%"
                left="50%"
                borderBottomWidth={ 1 }
                borderColor={ color }
            /> }
        </Box> :
        <XStack position="absolute"
            top={ 0 }
            right={ 0 }
            bottom={ 0 }
            left="50%"
            borderLeftWidth={ 1 }
            borderColor={ color }
        /> }</XStack> )
}

function rowHeight ( index: number, { item, leafHeight, branchHeight }: any ) {
    return ( item?.leaf ? leafHeight : branchHeight ) || 42
}

type RowProps = RowComponentProps<{
    flattened?: any[],
    expanded?: Set<string>,
    setExpanded?: ( exp: Set<string> ) => void
    leafStateByParentKey?: any
    expandedBranchesByKey?: any
    branchStateByParentKey?: any
}>

function Row<B, L> ( {
    index,
    style,

    accessLeafKey,
    accessBranchKey,
    renderLeaf,
    renderBranch,

    flattened,
    expanded,
    setExpanded,
    leafStateByParentKey,
    expandedBranchesByKey,
    branchStateByParentKey,

}: RowProps & TreeProps<B, L> ) {

    const {
        key: parentKey,
        index: localIndex,
        parents,
        branch,
        leaf,
        hasLeaves,
        hasBranches,
        isExpanded,
        isLast,
        isFirst,
    } = flattened?.[ index ] || {}

    const globalIndex = index

    if ( leaf ) {

        const key = accessLeafKey?.( leaf )
        const expand = () => { }, collapse = () => { }, toggle = () => { }
        const debug: any = { ...leafStateByParentKey?.current?.get( parentKey || "" ), parentKey }
        const options: NodeState & NodeActions = { globalIndex, localIndex, isLast, isFirst, isExpanded, hasBranches, hasLeaves, expand, collapse, toggle, depth: parents?.length || 0, ...debug }
        return <XStack key={ key } style={ style }>{ renderLeaf?.( leaf, options ) }</XStack>

    } else if ( branch ) {

        const key = accessBranchKey?.( branch )
        const isExpanded = expandedBranchesByKey?.current?.has( key )

        const toggle = () => {
            if ( expandedBranchesByKey?.current?.has( key ) ) {
                expandedBranchesByKey?.current?.delete( key )
                expanded?.delete( key! )
                setExpanded?.( new Set( expanded ) )
            } else {
                expandedBranchesByKey?.current?.set( key, branch )
                expanded?.add( key! )
                setExpanded?.( new Set( expanded ) )
            }
        }
        const expand = () => {
            expandedBranchesByKey?.current?.set( key, branch )
            expanded?.add( key! )
            setExpanded?.( new Set( expanded ) )
        }
        const collapse = () => {
            expandedBranchesByKey?.current?.delete( key )
            expanded?.delete( key! )
            setExpanded?.( new Set( expanded ) )
        }
        // const toggle = expandedBranchesByKey?.current?.has( key ) ? collapse : expand
        const debug: any = { ...branchStateByParentKey?.current?.get( parentKey || "" ), parentKey }
        const options: NodeState & NodeActions = { globalIndex, localIndex, isLast, isFirst, isExpanded, hasBranches, hasLeaves, expand, collapse, toggle, depth: parents?.length || 0, ...debug }
        return <XStack key={ key } style={ style }>{ renderBranch?.( branch, options ) }</XStack>

    } else return <Box key={ "rnd-" + Math.random() } style={ style }></Box>

}

// import { ReactNode, useCallback, useEffect, useRef, useState, type ElementType } from "react"
// import { List as VirtualizedList } from 'react-window'
// import { XStack } from "@aarock/ui-core"

// export const ROOT_KEY = "__ROOT__"

// export type EdgeState = {
//     total?: number
//     offset: number
//     limit: number
//     cursor: string | null
//     loading: boolean
//     complete: boolean
// }

// export type EdgeActions = {
//     setOffset: ( offset: number ) => void
//     setLimit: ( limit: number ) => void
//     setTotal: ( total: number ) => void
//     setCursor: ( cursor: string | null ) => void
//     setComplete: ( cursor: boolean ) => void
// }

// export type NodeState = {
//     depth: number
//     hasParent: boolean
//     isExpanded: boolean
//     isFirst: boolean
//     isLast: boolean
//     hasBranches: boolean
//     hasLeaves: boolean
// }

// export type NodeActions = {
//     expand: () => void
//     collapse: () => void
//     toggle: () => void
// }

// export type Node<B, L = B> = {
//     key?: string
//     branch?: B
//     parents?: B[]
//     branches?: B[]
//     // branchesTotal?: number
//     // branchesOffset?: number
//     // branchesLimit?: number
//     // branchesCursor?: string | null
//     leaf?: L
//     leaves?: L[]
//     // leavesTotal?: number
//     // leavesOffset?: number
//     // leavesLimit?: number
//     // hasParent?: boolean
//     isExpanded?: boolean
//     isFirst?: boolean
//     isLast?: boolean

//     hasBranches?: boolean
//     hasLeaves?: boolean
// }

// export type TreeProps<B = any, L = B> = {
//     Wrapper?: ElementType
//     branchType?: B
//     leafType?: L
//     // shouldRenderRoot?: boolean
//     accessBranches?: ( branch: B | null, options: EdgeState & EdgeActions ) => ( B[] | Promise<B[]> )
//     accessLeaves?: ( branch: B | null, options: EdgeState & EdgeActions ) => ( L[] | Promise<L[]> )
//     accessBranchKey?: ( branch: B ) => string
//     accessLeafKey?: ( leaf: L ) => string
//     renderBranch?: ( branch: B, options: NodeState & NodeActions ) => ReactNode
//     renderLeaf?: ( leaf: L, options: NodeState & NodeActions ) => ReactNode
// }

// export function Tree<B = any, L = B> ( {
//     // root,
//     // shouldRenderRoot,
//     Wrapper,
//     accessBranches, // = () => [] as B[],
//     accessLeaves, // = () => [] as L[],
//     accessBranchKey = ( branch: any ) => branch?.id || "",
//     accessLeafKey = ( leaf: any ) => leaf?.id || "",
//     renderBranch,
//     renderLeaf,
// }: TreeProps<B, L> ) {

//     // const rootKey = ( root && accessBranchKey( root ) ) || ROOT_KEY
//     const branchesByParentKey = useRef<Map<string, B[]>>( new Map() )
//     const leavesByParentKey = useRef<Map<string, L[]>>( new Map() )
//     const branchStateByParentKey = useRef<Map<string, EdgeState>>( new Map() )
//     const leafStateByParentKey = useRef<Map<string, EdgeState>>( new Map() )
//     const expandedBranchesByKey = useRef<Map<string, B>>( new Map() )
//     const branchesByKey = useRef<Map<string, B>>( new Map() )
//     const globalLoadState = useRef<boolean>( false )

//     const [ expanded, setExpanded ] = useState<Set<string>>( new Set( [] ) )
//     const [ incomplete, setIncomplete ] = useState<B[]>( [] )
//     const [ flattened, setFlattened ] = useState<Node<B, L>[]>( [] )

//     // takes a branch of a tree and flattens out all sub-branches and sub-leaves
//     // into an array of nodes for renreing. returns the flattened array.
//     const flatten = useCallback( ( branch?: B | null, parents?: B[], state?: Partial<Node<B, L>> ): Node<B, L>[] => {

//         const isRoot = !branch
//         const branchKey = branch ? accessBranchKey( branch ) : ROOT_KEY
//         const parentBranches = parents || [] as B[]
//         const parentBranch = parentBranches[ parentBranches.length - 1 ] || undefined
//         const parentBranchKey = parentBranch ? accessBranchKey( parentBranch ) : undefined
//         const isExpanded = isRoot || expandedBranchesByKey.current.has( branchKey )

//         const subBranches = ( isExpanded && branchesByParentKey.current.get( branchKey ) ) || [] as B[]
//         const subLeaves = ( isExpanded && leavesByParentKey.current.get( branchKey ) ) || [] as L[]
//         // const hasMoreBranches = !branchStateByParentKey.current.get( branchKey )?.complete
//         const hasMoreLeaves = !leafStateByParentKey.current.get( branchKey )?.complete
//         const parentsIncludingCurrent = [ ...parentBranches, ...branch ? [ branch ] : [] ]
//         return [
//             ...isRoot ? [] : [ {
//                 key: parentBranchKey,
//                 parents: parentBranches,
//                 branch,
//                 ...state
//             } ],
//             ...subBranches.map( ( subBranch, i ) => flatten( subBranch, parentsIncludingCurrent, {
//                 isFirst: i === 0,
//                 isLast: i === subBranches.length - 1,
//                 hasBranches: true,
//                 hasLeaves: !!subBranches.length
//             } ) ).flat(),
//             ...subLeaves.map( ( leaf, i ) => ( {
//                 parents: parentsIncludingCurrent,
//                 key: branchKey, leaf,
//                 isFirst: i === 0,
//                 isLast: i === subLeaves.length - 1,
//                 hasMore: hasMoreLeaves,
//                 hasParent: !isRoot,
//                 hasLeaves: true,
//                 hasBranches: !!subBranches.length
//             } ) ),
//         ]
//     }, [ expanded ] )

//     // given a branch of a tree, re-fetches and chaches all sub-branches and sub-leaves
//     // that have not already been marked as completed. does a comparison of results before
//     // merging.
//     const loadMore = useCallback( async ( parent: B | null = null ) => {

//         // if ( globalLoadState.current ) return
//         globalLoadState.current = true

//         const isRoot = !parent
//         const branchKey = parent ? accessBranchKey( parent ) : ROOT_KEY
//         const defaultState = { cursor: null, total: undefined, offset: 0, limit: 1000, loading: false, complete: false }

//         if ( !branchStateByParentKey.current.has( branchKey ) ) branchStateByParentKey.current.set( branchKey, defaultState )
//         if ( !leafStateByParentKey.current.has( branchKey ) ) leafStateByParentKey.current.set( branchKey, defaultState )
//         if ( !branchesByParentKey.current.has( branchKey ) ) branchesByParentKey.current.set( branchKey, [] )
//         if ( !leavesByParentKey.current.has( branchKey ) ) leavesByParentKey.current.set( branchKey, [] )

//         const branchState = branchStateByParentKey.current.get( branchKey ) || defaultState
//         const leafState = leafStateByParentKey.current.get( branchKey ) || defaultState

//         const branchOptions: EdgeState & EdgeActions = {
//             ...defaultState,
//             ...branchState,
//             // setCursor: ( cursor: string | null ) => branchStateByParentKey.current.get( branchKey )!.cursor = cursor,
//             // setTotal: ( total: number ) => branchStateByParentKey.current.get( branchKey )!.total = total,
//             // setOffset: ( offset: number ) => branchStateByParentKey.current.get( branchKey )!.offset = offset,
//             // setLimit: ( limit: number ) => branchStateByParentKey.current.get( branchKey )!.limit = limit,
//             // setComplete: ( complete: boolean ) => branchStateByParentKey.current.get( branchKey )!.complete = complete,
//             setCursor: ( cursor: string | null ) => branchState.cursor = cursor,
//             setTotal: ( total: number ) => branchState.total = total,
//             setOffset: ( offset: number ) => branchState.offset = offset,
//             setLimit: ( limit: number ) => branchState.limit = limit,
//             setComplete: ( complete: boolean ) => branchState.complete = complete,
//         }

//         const leafOptions: EdgeState & EdgeActions = {
//             ...defaultState,
//             ...leafState,
//             setCursor: ( cursor: string | null ) => leafState.cursor = cursor,
//             setTotal: ( total: number ) => leafState.total = total,
//             setOffset: ( offset: number ) => leafState.offset = offset,
//             setLimit: ( limit: number ) => leafState.limit = limit,
//             setComplete: ( complete: boolean ) => leafState.complete = complete,
//         }

//         const isExpanded = isRoot || expanded.has( branchKey )
//         const shouldFetchBranches = !branchState.complete && !branchState.loading
//         const shouldFetchLeaves = !leafState.complete && !leafState.loading && isExpanded

//         branchStateByParentKey.current.get( branchKey )!.loading = true
//         leafStateByParentKey.current.get( branchKey )!.loading = true

//         return Promise.all( [
//             shouldFetchBranches ? Promise.resolve( accessBranches?.( parent, branchOptions ) || [] ) : Promise.resolve( [] ),
//             shouldFetchLeaves ? Promise.resolve( accessLeaves?.( parent, leafOptions ) || [] ) : Promise.resolve( [] ),
//         ] ).then( ( [ branches, leaves ] ) => {

//             let numBranchesUpdated = 0
//             let numLeavesUpdated = 0

//             if ( shouldFetchBranches && branches.length ) {
//                 branchStateByParentKey.current.get( branchKey )!.loading = false
//                 const existingBranches = branchesByParentKey.current.get( branchKey )!
//                 branches.forEach( branch => {
//                     const existingIndex = existingBranches.findIndex( existing => accessBranchKey( existing ) === accessBranchKey( branch ) )
//                     if ( existingIndex === -1 ) branchesByKey.current.set( accessBranchKey( branch ), branch )
//                     if ( existingIndex === -1 ) numBranchesUpdated++
//                     if ( existingIndex !== -1 ) existingBranches[ existingIndex ] = branch
//                     else existingBranches.push( branch )
//                 } )
//             }

//             if ( shouldFetchLeaves && leaves.length ) {
//                 leafStateByParentKey.current.get( branchKey )!.loading = false
//                 const existingLeaves = leavesByParentKey.current.get( branchKey )!
//                 leaves.forEach( leaf => {
//                     const existingIndex = existingLeaves.findIndex( existing => accessLeafKey( existing ) === accessLeafKey( leaf ) )
//                     if ( existingIndex === -1 ) numLeavesUpdated++
//                     if ( existingIndex !== -1 ) existingLeaves[ existingIndex ] = leaf
//                     else existingLeaves.push( leaf )
//                 } )
//             }

//             if ( !numBranchesUpdated ) branchStateByParentKey.current.get( branchKey )!.complete = true
//             if ( !numLeavesUpdated ) leafStateByParentKey.current.get( branchKey )!.complete = true

//         } )
//             .then( () => globalLoadState.current = false )
//             .catch( err => globalLoadState.current = false )

//     }, [ expanded ] )

//     // kick things off by initiating the loadMore from the root
//     useEffect( () => {
//         console.log( "INITIAL LOAD" )
//         loadMore( null ).then( () => setFlattened( flatten( null ) ) )
//     }, [] )

//     // whenever folders open, load the folder
//     useEffect( () => {
//         Promise.all( [ ...expanded ].map( key => {
//             const branch = expandedBranchesByKey.current?.get( key )
//             if ( branch ) return loadMore( branch )
//             return Promise.resolve()
//         } ) ).then( () => setFlattened( flatten() ) )
//     }, [ expanded ] )

//     // whenever incompletes change.. load them
//     useEffect( () => {
//         Promise.all( incomplete.map( branch => {
//             if ( branch ) return loadMore( branch )
//             return Promise.resolve()
//         } ) ).then( () => setFlattened( flatten() ) )
//     }, [ incomplete ] )

//     const Row = ( { index, style }: any ) => {

//         const {
//             key: parentKey,
//             parents,
//             branch,
//             leaf,
//             hasLeaves,
//             hasBranches,
//             isExpanded,
//             isLast,
//             isFirst,
//         } = flattened[ index ]

//         if ( leaf ) {

//             const key = accessLeafKey( leaf )
//             const expand = () => { }, collapse = () => { }, toggle = () => { }
//             const debug: any = { ...leafStateByParentKey.current.get( parentKey || "" ), parentKey }
//             const options: NodeState & NodeActions = { isLast, isFirst, isExpanded, hasBranches, hasLeaves, expand, collapse, toggle, depth: parents?.length || 0, ...debug }
//             return <XStack key={ key } style={ style }>{ renderLeaf?.( leaf, options ) }</XStack>

//         } else if ( branch ) {

//             const key = accessBranchKey( branch )
//             const isExpanded = expandedBranchesByKey.current.has( key )
//             const expand = () => {
//                 expandedBranchesByKey.current.set( key, branch )
//                 expanded.add( key )
//                 setExpanded( new Set( expanded ) )
//             }
//             const collapse = () => {
//                 expandedBranchesByKey.current.delete( key )
//                 expanded.delete( key )
//                 setExpanded( new Set( expanded ) )
//             }
//             const toggle = isExpanded ? collapse : expand
//             const debug: any = { ...branchStateByParentKey.current.get( parentKey || "" ), parentKey }
//             const options: NodeState & NodeActions = { isLast, isFirst, isExpanded, hasBranches, hasLeaves, expand, collapse, toggle, depth: parents?.length || 0, ...debug }
//             return <XStack key={ key } style={ style }>{ renderBranch?.( branch, options ) }</XStack>

//         } else return <div key={ "rnd-" + Math.random() } style={ style }></div>

//     }

//     return <VirtualizedList
//         // width={ 200 }
//         // height={ 1000 }
//         // data={ flattened }
//         // itemContent={ ( index ) => flattened[ index ] }
//         // keyExtractor={ ( { leaf, group }, i ) => accessLeafKey( leaf ) || accessBranchKey( group ) || `${ i }` }
//         rowCount={ flattened.length }
//         rowProps={ index => ({}) }
//         rowHeight={ index => 50 }
//         rowComponent={ Row }
//         // onRowsRendered={ ( { startIndex, stopIndex } ) => {
//         onRowsRendered={ ( { startIndex, stopIndex } ) => {

//             const viewableNodes = flattened.slice( startIndex, stopIndex )

//             const lastEntryParentKeys = viewableNodes
//                 .filter( ( { isLast } ) => isLast )
//                 .map( ( { key } ) => key as string )
//                 .filter( Boolean )

//             const incompleteParents = [ ...new Set( lastEntryParentKeys ) ]
//                 .map( key => branchesByKey.current.get( key as string ) as B )
//                 .filter( Boolean )

//             setIncomplete( incompleteParents )

//         } }
//     // itemContent={ ( { item: { key: parentKey, parents, branch, leaf, hasParent, isExpanded, isLast, isFirst, hasBranches, hasLeaves } } ) => {

//     // rangeChanged={ ( { startIndex, endIndex } ) => {


//     // } }

//     />

// }

// export type StemProps = {
//     depth?: number
//     color?: string
//     isFirst?: boolean
//     isLast?: boolean
//     width?: number
//     reachY?: number
// }

// export function Stem ( {
//     depth = 0,
//     color = "$neutral6",
//     isFirst,
//     isLast,
//     width = 32,
//     reachY = 0
// }: StemProps ) {

//     return Array( depth ).fill( 0 ).map( ( _, i ) => <XStack
//         key={ "dpth-" + i }
//         position="relative"
//         width={ width }
//         height="100%"
//     >{ i === depth - 1 ?
//         <>
//             <XStack position="absolute"
//                 top={ isFirst ? -reachY : 0 }
//                 right={ 0 }
//                 bottom={ isLast ? "50%" : 0 }
//                 left="50%"
//                 borderLeftWidth={ 1 }
//                 borderBottomWidth={ isLast ? 1 : 0 }
//                 borderBottomLeftRadius={ isLast ? "$sm" : 0 }
//                 borderColor={ color }
//             />
//             { !isLast && <XStack position="absolute"
//                 top={ 0 }
//                 right={ 0 }
//                 bottom="50%"
//                 left="50%"
//                 borderBottomWidth={ 1 }
//                 borderColor={ color }
//             /> }
//         </> :
//         <XStack position="absolute"
//             top={ 0 }
//             right={ 0 }
//             bottom={ 0 }
//             left="50%"
//             borderLeftWidth={ 1 }
//             borderColor={ color }
//         /> }</XStack> )
// }
