const PARSER = new DOMParser();

/**
 * Takes an HTML string and returns an DocumentFragment object containing HTML element objects.  If the input has a
 * single root element like "<div><p>child</p></div>", you can access it via fragment.firstElementChild.  Otherwise, if
 * it's multiple elements like "<li>item1</li><li>item2</li>" you can access them via fragment.children.
 *
 * @param {string} htmlString - a string of some HTML
 * @return {DocumentFragment} - DocumentFragment object containing HTML elements
 */
export function toHtmlElement(htmlString) {
    const doc = PARSER.parseFromString(htmlString, "text/html");
    const collection = doc.head.childElementCount
        ? doc.head.children
        : doc.body.children;
    const fragment = new DocumentFragment();

    fragment.replaceChildren(...collection);
    return fragment;
}
