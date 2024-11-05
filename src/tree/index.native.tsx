import { XStack } from "@aarock/ui-core"
import { VirtualizedList } from "react-native"
import { ReactNode, useCallback, useEffect, useRef, useState } from "react"

export const ROOT_KEY = "__ROOT__"

export type EdgeState = {
    total?: number
    offset: number
    limit: number
    cursor: string | null
    loading: boolean
    complete: boolean
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
    // isExpanded?: boolean
    isFirst?: boolean
    isLast?: boolean

    hasBranches?: boolean
    hasLeaves?: boolean
}

export type TreeProps<B = any, L = B> = {
    branchType?: B
    leafType?: L
    // shouldRenderRoot?: boolean
    accessBranches?: ( branch: B | null, options: EdgeState & EdgeActions ) => ( B[] | Promise<B[]> )
    accessLeaves?: ( branch: B | null, options: EdgeState & EdgeActions ) => ( L[] | Promise<L[]> )
    accessBranchKey?: ( branch: B ) => string
    accessLeafKey?: ( leaf: L ) => string
    renderBranch?: ( branch: B, options: NodeState & NodeActions ) => ReactNode
    renderLeaf?: ( leaf: L, options: NodeState & NodeActions ) => ReactNode
}

export function Tree<B = any, L = B> ( {
    // root,
    // shouldRenderRoot,
    accessBranches, // = () => [] as B[],
    accessLeaves, // = () => [] as L[],
    accessBranchKey = ( branch: any ) => branch?.id || "",
    accessLeafKey = ( leaf: any ) => leaf?.id || "",
    renderBranch,
    renderLeaf,
}: TreeProps<B, L> ) {

    // const rootKey = ( root && accessBranchKey( root ) ) || ROOT_KEY
    const branchesByParentKey = useRef<Map<string, B[]>>( new Map() )
    const leavesByParentKey = useRef<Map<string, L[]>>( new Map() )
    const branchStateByParentKey = useRef<Map<string, EdgeState>>( new Map() )
    const leafStateByParentKey = useRef<Map<string, EdgeState>>( new Map() )
    const expandedBranchesByKey = useRef<Map<string, B>>( new Map() )
    const branchesByKey = useRef<Map<string, B>>( new Map() )
    const globalLoadState = useRef<boolean>( false )

    const [ expanded, setExpanded ] = useState<Set<string>>( new Set( [] ) )
    const [ incomplete, setIncomplete ] = useState<B[]>( [] )
    const [ flattened, setFlattened ] = useState<Node<B, L>[]>( [] )

    // takes a branch of a tree and flattens out all sub-branches and sub-leaves
    // into an array of nodes for renreing. returns the flattened array.
    const flatten = useCallback( ( branch?: B | null, parents?: B[], state?: Partial<Node<B, L>> ): Node<B, L>[] => {

        const isRoot = !branch
        const branchKey = branch ? accessBranchKey( branch ) : ROOT_KEY
        const parentBranches = parents || [] as B[]
        const parentBranch = parentBranches[ parentBranches.length - 1 ] || undefined
        const parentBranchKey = parentBranch ? accessBranchKey( parentBranch ) : undefined
        const isExpanded = isRoot || expandedBranchesByKey.current.has( branchKey )

        const subBranches = ( isExpanded && branchesByParentKey.current.get( branchKey ) ) || [] as B[]
        const subLeaves = ( isExpanded && leavesByParentKey.current.get( branchKey ) ) || [] as L[]
        // const hasMoreBranches = !branchStateByParentKey.current.get( branchKey )?.complete
        const hasMoreLeaves = !leafStateByParentKey.current.get( branchKey )?.complete
        const parentsIncludingCurrent = [ ...parentBranches, ...branch ? [ branch ] : [] ]
        return [
            ...isRoot ? [] : [ {
                key: parentBranchKey,
                parents: parentBranches,
                branch,
                ...state
            } ],
            ...subBranches.map( ( subBranch, i ) => flatten( subBranch, parentsIncludingCurrent, {
                isFirst: i === 0,
                isLast: i === subBranches.length - 1,
                hasBranches: true,
                hasLeaves: !!subBranches.length
            } ) ).flat(),
            ...subLeaves.map( ( leaf, i ) => ( {
                parents: parentsIncludingCurrent,
                key: branchKey, leaf,
                isFirst: i === 0,
                isLast: i === subLeaves.length - 1,
                hasMore: hasMoreLeaves,
                hasParent: !isRoot,
                hasLeaves: true,
                hasBranches: !!subBranches.length
            } ) ),
        ]
    }, [ expanded ] )

    // given a branch of a tree, re-fetches and chaches all sub-branches and sub-leaves
    // that have not already been marked as completed. does a comparison of results before
    // merging.
    const loadMore = useCallback( async ( parent: B | null = null ) => {

        // if ( globalLoadState.current ) return
        globalLoadState.current = true

        const isRoot = !parent
        const branchKey = parent ? accessBranchKey( parent ) : ROOT_KEY
        const defaultState = { cursor: null, total: undefined, offset: 0, limit: 1000, loading: false, complete: false }

        if ( !branchStateByParentKey.current.has( branchKey ) ) branchStateByParentKey.current.set( branchKey, defaultState )
        if ( !leafStateByParentKey.current.has( branchKey ) ) leafStateByParentKey.current.set( branchKey, defaultState )
        if ( !branchesByParentKey.current.has( branchKey ) ) branchesByParentKey.current.set( branchKey, [] )
        if ( !leavesByParentKey.current.has( branchKey ) ) leavesByParentKey.current.set( branchKey, [] )

        const branchState = branchStateByParentKey.current.get( branchKey ) || defaultState
        const leafState = leafStateByParentKey.current.get( branchKey ) || defaultState

        const branchOptions: EdgeState & EdgeActions = {
            ...defaultState,
            ...branchState,
            // setCursor: ( cursor: string | null ) => branchStateByParentKey.current.get( branchKey )!.cursor = cursor,
            // setTotal: ( total: number ) => branchStateByParentKey.current.get( branchKey )!.total = total,
            // setOffset: ( offset: number ) => branchStateByParentKey.current.get( branchKey )!.offset = offset,
            // setLimit: ( limit: number ) => branchStateByParentKey.current.get( branchKey )!.limit = limit,
            // setComplete: ( complete: boolean ) => branchStateByParentKey.current.get( branchKey )!.complete = complete,
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
        const shouldFetchBranches = !branchState.complete && !branchState.loading
        const shouldFetchLeaves = !leafState.complete && !leafState.loading && isExpanded

        branchStateByParentKey.current.get( branchKey )!.loading = true
        leafStateByParentKey.current.get( branchKey )!.loading = true

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

            if ( !numBranchesUpdated ) branchStateByParentKey.current.get( branchKey )!.complete = true
            if ( !numLeavesUpdated ) leafStateByParentKey.current.get( branchKey )!.complete = true

        } )
            .then( () => globalLoadState.current = false )
            .catch( err => globalLoadState.current = false )

    }, [ expanded ] )

    // kick things off by initiating the loadMore from the root
    useEffect( () => {
        console.log( "INITIAL LOAD" )
        loadMore( null ).then( () => setFlattened( flatten( null ) ) )
    }, [] )

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

    return <VirtualizedList
        data={ flattened }
        getItem={ ( data, index ) => data[ index ] }
        getItemCount={ ( data ) => data.length }
        keyExtractor={ ( { leaf, group }, i ) => accessLeafKey( leaf ) || accessBranchKey( group ) || `${ i }` }
        renderItem={ ( { item: { key: parentKey, parents, branch, leaf, hasParent, isExpanded, isLast, isFirst, hasBranches, hasLeaves } } ) => {
            if ( leaf ) {

                const key = accessLeafKey( leaf )
                const expand = () => { }, collapse = () => { }, toggle = () => { }
                const debug: any = { ...leafStateByParentKey.current.get( parentKey ), parentKey }
                const options: NodeState & NodeActions = { hasParent, isExpanded, isLast, isFirst, hasBranches, hasLeaves, expand, collapse, toggle, depth: parents.length, ...debug }
                return <XStack key={ key }>{ renderLeaf?.( leaf, options ) }</XStack>

            } else if ( branch ) {

                const key = accessBranchKey( branch )
                const isExpanded = expandedBranchesByKey.current.has( key )
                const expand = () => {
                    expandedBranchesByKey.current.set( key, branch )
                    expanded.add( key )
                    setExpanded( new Set( expanded ) )
                }
                const collapse = () => {
                    expandedBranchesByKey.current.delete( key )
                    expanded.delete( key )
                    setExpanded( new Set( expanded ) )
                }
                const toggle = isExpanded ? collapse : expand
                const debug: any = { ...branchStateByParentKey.current.get( parentKey ), parentKey }
                const options: NodeState & NodeActions = { hasParent, isExpanded, isLast, isFirst, hasBranches, hasLeaves, expand, collapse, toggle, depth: parents.length, ...debug }
                return <XStack key={ key }>{ renderBranch?.( branch, options ) }</XStack>

            } else return null

        } }
        viewabilityConfig={ { itemVisiblePercentThreshold: 1, minimumViewTime: 0 } }
        onViewableItemsChanged={ ( { viewableItems, changed } ) => {

            const lastEntryParentKeys = viewableItems
                .map( option => option.item as Node<B, L> )
                .filter( ( { isLast } ) => isLast )
                .map( ( { key } ) => key as string )
                .filter( Boolean )

            const incompleteParents = [ ...new Set( lastEntryParentKeys ) ]
                .map( key => branchesByKey.current.get( key ) as B )
                .filter( Boolean )

            setIncomplete( incompleteParents )

        } }

    />
}
