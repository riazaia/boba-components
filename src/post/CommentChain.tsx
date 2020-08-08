import React from "react";
import Comment, { CommentHandler } from "./Comment";

const CommentChain = React.forwardRef<CommentHandler, CommentChainProps>(
  (props, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const handlerRefs = React.useRef(new Map<number, CommentHandler>());

    React.useImperativeHandle(ref, () => ({
      highlight: (color: string) => {
        handlerRefs.current.forEach((ref) => ref.highlight(color));
      },
    }));
    React.useEffect(() => {
      props.comments.forEach((comment, index) => {
        const commentRef = handlerRefs.current.get(index);
        if (!commentRef?.editorRef?.current) {
          return;
        }
        if (index != 0) {
          commentRef.editorRef.current.style.borderTopLeftRadius = "0px";
          commentRef.editorRef.current.style.borderTopRightRadius = "0px";
          commentRef.editorRef.current.style.borderTop = "1px dotted white";
        }
        if (index < handlerRefs.current.size - 1) {
          commentRef.editorRef.current.style.borderBottomLeftRadius = "0px";
          commentRef.editorRef.current.style.borderBottomRightRadius = "0px";
          commentRef.editorRef.current.style.borderBottom = "none";
        }
      });
    }, [props.comments]);

    React.useEffect(() => {
      console.log("parent");
      if (!containerRef.current) {
        return;
      }
      console.log("parent");
      console.log(
        getComputedStyle(containerRef.current).getPropertyValue(
          "--comment-container-stacked-radius"
        )
      );
      containerRef.current?.style.setProperty(
        "--comment-container-stacked-radius",
        "0"
      );
    }, [containerRef.current]);

    return (
      <div className="comment-chain" ref={containerRef}>
        {props.comments.map((comment, index) => (
          <Comment
            id={comment.id}
            key={`comment_${comment.id}`}
            ref={(ref: CommentHandler) => handlerRefs.current.set(index, ref)}
            initialText={comment.text}
            userIdentity={props.userIdentity}
            secretIdentity={props.secretIdentity}
            paddingTop={"0"}
            muted={props.muted}
          />
        ))}
        <style jsx>{`
          .comment-chain {
            padding-top: 15px;
            position: relative;
          }
          .editor.chainable {
            margin-bottom: 15px;
          }
        `}</style>
      </div>
    );
  }
);

export interface CommentChainProps {
  comments: { id: string; text: string }[];
  secretIdentity: {
    avatar: string;
    name: string;
  };
  userIdentity?: {
    avatar: string;
    name: string;
  };
  muted?: boolean;
}

export default CommentChain;
