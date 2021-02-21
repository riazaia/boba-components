import React, { Children, MutableRefObject } from "react";

import Theme from "../theme/default";
import CollapsedPlaceholder from "./CollapsedPlaceholder";
import CircleMask from "../images/circle-mask.svg";
import RectangleMask from "../images/rectangle-mask.svg";
import classnames from "classnames";
import css from "styled-jsx/css";

const INDENT_WIDTH_PX = 8;
const getThreadCss = (level: number) => css.resolve`
  ol.level-container {
    list-style: none;
    position: relative;
    margin-inline-start: ${INDENT_WIDTH_PX}px;
    padding-inline-start: 0;
    pointer-events: none;
  }
  div[data-level="0"],
  ol.level-container[data-level="1"] {
    padding-inline-start: 0;
    margin-inline-start: 0;
  }
  li.level-item {
    position: relative;
    pointer-events: none;
  }
  .thread-element {
    position: relative;
    z-index: 1;
    pointer-events: none;
  }
  .thread-element
    > :global(*:not(.level-item .level-container .thread-element)) {
    pointer-events: all;
  }
  .thread-stem {
    position: absolute;
    top: 0;
    bottom: -10px;
    left: ${INDENT_WIDTH_PX}px;
    width: ${INDENT_WIDTH_PX}px;
    background-color: ${Theme.INDENT_COLORS[
      level % Theme.INDENT_COLORS.length
    ]};
    border-radius: 15px;
    pointer-events: all;
    border: 0;
    padding: 0;
  }
  .thread-stem.hover {
    cursor: pointer;
    background-color: purple;
  }
  div[data-level="0"] > .thread-stem {
    left: 0px;
  }
  div[data-level="0"] {
    position: relative;
  }
`;

interface ThreadContext extends ThreadProps {
  addResizeCallback: (callback: () => void) => void;
  removeResizeCallback: (callback: () => void) => void;
}

const ThreadContext = React.createContext<ThreadContext | null>(null);
const ThreadLevel = React.createContext<number>(0);
const ThreadStem = React.createContext<{
  visible: boolean;
  setVisible: (x: boolean) => void;
} | null>(null);

interface ThreadProps {
  onCollapseLevel: (id: string) => void;
  onUncollapseLevel: (id: string) => void;
  getCollapseReason: (id: string) => React.ReactNode;
}

interface IndentProps {
  id: string | null;
  collapsed: boolean;
  level?: number;
  // Internal: do not use.
  childOfItem?: boolean;
  marginTop?: number;
}

interface CollapseGroupProps extends IndentProps {
  endsLevel?: boolean;
}

const isIndentElement = (
  node: React.ReactNode
): node is React.Component<IndentProps> => {
  return React.isValidElement(node) && node.type == Indent;
};

const isThreadItem = (
  node: React.ReactNode
): node is React.Component<IndentProps> => {
  return React.isValidElement(node) && node.type == Item;
};

const isCollapseGroup = (
  node: React.ReactNode
): node is React.Component<CollapseGroupProps> => {
  return React.isValidElement(node) && node.type == CollapseGroup;
};

const processItemChildren = (children: React.ReactNode | undefined) => {
  const indent = Children.toArray(children).find(isIndentElement);
  const levelItems = Children.toArray(children).filter(
    (child) => !isIndentElement(child)
  );
  return { levelItems, indent };
};

/**
 * This is how the thread structure is supposed to look like:
 *
 * <Thread>
 *   <Post>
 *   <Thread.Indent>
 *     <Thread.Item><Post></Thread.Item>
 *     <Thread.Item><Post></Thread.Item>
 *     <Thread.Item><Post></Thread.Item>
 *     <Thread.Item>
 *        <Post>
 *        <Thread.Indent>
 *          <Thread.Item><Post></Thread.Item>
 *          <Thread.Item><Post></Thread.Item>
 *        </Thread.Indent>
 *      </Thread.Item>
 *   </Thread.Indent>
 * </Thread>
 *
 * IMPORTANT NOTE: Thread.Indent should always be a direct discendant of Thread.Item.
 * If a component is wrapped around levels of these tree, make sure that it wraps a
 * Thread.Item and not simply the indentation.
 */
const Thread: React.FC<ThreadProps> & {
  Indent: typeof Indent;
  Item: typeof Item;
} = (props) => {
  // Thread should have up to two children, one which is the item to display at "level 0",
  // and a potential second element of type Thread.Indent, which contains the subthread.
  // Actually, at least for now, we just take all the children that aren't an indent, and simply
  // display them as the "top" element.
  const resizeCallbacks = React.useRef<(() => void)[]>([]);
  const threadRef = React.createRef<HTMLDivElement>();

  const addResizeCallback = React.useCallback((callback: () => void) => {
    resizeCallbacks.current.push(callback);
  }, []);
  const removeResizeCallback = React.useCallback((callback: () => void) => {
    resizeCallbacks.current = resizeCallbacks.current.filter(
      (entry) => callback != entry
    );
  }, []);

  React.useEffect(() => {
    if (!threadRef.current) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      resizeCallbacks.current.forEach((callback) => callback());
    });
    resizeObserver.observe(threadRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [threadRef]);
  const providedValues = React.useMemo(
    () => ({
      ...props,
      addResizeCallback,
      removeResizeCallback,
    }),
    [props, addResizeCallback, removeResizeCallback]
  );

  // We wrap both elements in a Thread.Item, so we can simply use the regular Thread.Item
  // recursion even for the first level.
  return (
    <ThreadContext.Provider value={providedValues}>
      <div className="thread" ref={threadRef}>
        <Thread.Item>{props.children}</Thread.Item>
        <style jsx>{`
          .thread {
            width: 100%;
            max-width: 550px;
          }
        `}</style>
      </div>
    </ThreadContext.Provider>
  );
};

export const CollapseGroup: React.FC<CollapseGroupProps> = (props) => {
  const threadContext = React.useContext(ThreadContext);
  return props.collapsed ? (
    <div
      className={classnames("collapsed", { "ends-level": !!props.endsLevel })}
    >
      <div className="placeholder">
        <CollapsedPlaceholder
          onUncollapseClick={() =>
            threadContext?.onUncollapseLevel?.(props.id as string)
          }
        >
          {threadContext?.getCollapseReason?.(props.id as string)}
        </CollapsedPlaceholder>
      </div>
      <div className="background" />
      <style jsx>{`
        .collapsed {
          pointer-events: all;
          margin-bottom: 20px;
          position: relative;
        }
        .placeholder {
          z-index: 2;
          position: relative;
        }
        .collapsed .background {
          mask: url(${RectangleMask}), url(${CircleMask}) 0px -6px/8px 10px;
          mask-composite: source-out;
          mask-repeat: repeat-y;
          background-color: #2e2e30;
          position: absolute;
          top: -15px;
          bottom: -17px;
          left: 0;
          width: ${INDENT_WIDTH_PX}px;
          z-index: 1;
        }
        .collapsed.ends-level .background {
          bottom: 10px;
        }
      `}</style>
    </div>
  ) : (
    <>{props.children}</>
  );
};

const Item: React.FC<{ children?: React.ReactNode }> = (props) => {
  const level = React.useContext(ThreadLevel);
  const threadContext = React.useContext(ThreadContext);
  const { styles, className } = getThreadCss(level);
  const [
    boundaryElement,
    setBoundaryElement,
  ] = React.useState<HTMLElement | null>(null);
  // We only wrap the result in a <li> when it's above level 0.
  let children: React.ReactNode = props.children;
  if (typeof props.children == "function") {
    children = props.children(setBoundaryElement);
    if (React.isValidElement(children) && children.type == React.Fragment) {
      children = children.props.children;
    }
  }

  const { levelItems, indent } = processItemChildren(children);
  if (Children.toArray(children).some(isThreadItem)) {
    throw new Error("Items shouldn't be children of items");
  }
  const stemClickHandler = React.useCallback(() => {
    if (!indent) {
      return;
    }
    if (indent.props.collapsed) {
      threadContext?.onUncollapseLevel?.(indent.props.id as string);
    } else {
      threadContext?.onCollapseLevel?.(indent.props.id as string);
    }
  }, [threadContext, indent]);
  return (
    <>
      {level === 0 ? (
        <div data-level={0} className={className}>
          <div className={`thread-element ${className}`}>{levelItems}</div>
          {indent && (
            <Stem
              className={className}
              boundaryElement={boundaryElement}
              clickHandler={stemClickHandler}
            />
          )}
          {indent &&
            // @ts-ignore
            React.cloneElement(indent, {
              ...indent?.props,
              childOfItem: true,
              boundaryElement,
            })}
        </div>
      ) : (
        <li data-level={level} className={`level-item ${className}`}>
          {indent && (
            <Stem
              className={className}
              boundaryElement={boundaryElement}
              clickHandler={stemClickHandler}
            />
          )}
          <div className={`thread-element ${className}`}>{levelItems}</div>
          {indent &&
            // @ts-ignore
            React.cloneElement(indent, {
              ...indent?.props,
              childOfItem: true,
              positionElement: boundaryElement,
              boundaryElement,
            })}
        </li>
      )}
      {styles}
    </>
  );
};

interface StemProps {
  className: string;
  clickHandler: () => void;
  boundaryElement: HTMLElement | null;
}
export const Stem: React.FC<StemProps> = (props) => {
  const threadContext = React.useContext(ThreadContext);
  const stem = React.createRef<HTMLButtonElement>();
  const stemHoverEnterHandler = React.useCallback((e) => {
    const target = e.target as HTMLElement;
    target.classList.add("hover");
  }, []);
  const stemHoverLeaveHandler = React.useCallback((e) => {
    const target = e.target as HTMLElement;
    target.classList.remove("hover");
  }, []);
  // TODO: this can likely be done with CSS vars without triggering
  // a react re-render.
  const [marginTop, setMarginTop] = React.useState(10);

  React.useEffect(() => {
    if (!props.boundaryElement || !stem.current) {
      return;
    }

    // We use parent element here because the stem will be positioned relative
    // to it.
    const stemRef = stem.current.parentElement;
    if (!stemRef) {
      throw new Error("Found unattached stem.");
    }
    const boundaryElement = props.boundaryElement;
    const setTopMarginCallback = () => {
      const { top: stemTop } = stemRef.getBoundingClientRect();
      const { top } = boundaryElement.getBoundingClientRect();
      setMarginTop(top - stemTop);
    };
    threadContext?.addResizeCallback(setTopMarginCallback);
    setTopMarginCallback();
    return () => {
      threadContext?.removeResizeCallback(setTopMarginCallback);
    };
  }, [props.boundaryElement, threadContext, stem]);

  return (
    <>
      <button
        ref={stem}
        className={`thread-stem ${props.className}`}
        style={{ marginTop: marginTop + "px" }}
        onMouseEnter={stemHoverEnterHandler}
        onMouseLeave={stemHoverLeaveHandler}
        onClick={props.clickHandler}
      />
    </>
  );
};

export const Indent: React.FC<IndentProps> = (props) => {
  const level = React.useContext(ThreadLevel);
  const { styles, className } = getThreadCss(level);
  const childrenArray = React.Children.toArray(props.children);

  if (!props.childOfItem) {
    throw new Error("indent should be child of item");
  }

  const toRender = childrenArray.flatMap((child) =>
    isCollapseGroup(child) && !child.props.collapsed
      ? child.props.children
      : child
  );
  const indentContext = React.useContext(ThreadStem);
  if (indentContext && !indentContext.visible) {
    indentContext.setVisible(true);
  }

  return (
    <>
      <ol data-level={level + 1} className={`level-container ${className}`}>
        <ThreadLevel.Provider value={level + 1}>
          {props.collapsed ? <CollapseGroup {...props} endsLevel /> : toRender}
        </ThreadLevel.Provider>
        {styles}
      </ol>
    </>
  );
};

Thread.Indent = Indent;
Thread.Item = Item;
export default Thread;
