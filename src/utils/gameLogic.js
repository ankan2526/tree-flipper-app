function toggleColor(color) {
  return color === 'red' ? 'blue' : 'red';
}

function toggleTree(node) {
  return {
    ...node,
    targetColor: toggleColor(node.targetColor),
    children: node.children.map(toggleTree),
  };
}

export function flipSubtree(nodeId, tree) {
  if (!tree) {
    return tree;
  }

  if (tree.id === nodeId) {
    return toggleTree(tree);
  }

  let found = false;
  const children = tree.children.map((child) => {
    if (found) {
      return child;
    }

    const updatedChild = flipSubtree(nodeId, child);
    if (updatedChild !== child) {
      found = true;
    }
    return updatedChild;
  });

  return found ? { ...tree, children } : tree;
}

export function flipSingleNode(nodeId, tree) {
  if (!tree) {
    return tree;
  }

  if (tree.id === nodeId) {
    return { ...tree, targetColor: toggleColor(tree.targetColor) };
  }

  let found = false;
  const children = tree.children.map((child) => {
    if (found) {
      return child;
    }

    const updatedChild = flipSingleNode(nodeId, child);
    if (updatedChild !== child) {
      found = true;
    }
    return updatedChild;
  });

  return found ? { ...tree, children } : tree;
}

export function checkWinCondition(currentTree, targetTree) {
  if (!currentTree || !targetTree) {
    return currentTree === targetTree;
  }

  if (
    currentTree.id !== targetTree.id ||
    currentTree.targetColor !== targetTree.targetColor ||
    currentTree.children.length !== targetTree.children.length
  ) {
    return false;
  }

  return currentTree.children.every((child, index) =>
    checkWinCondition(child, targetTree.children[index]),
  );
}
