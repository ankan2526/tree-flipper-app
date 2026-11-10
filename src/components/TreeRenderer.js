import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';

const NODE_RADIUS = 18;
const HORIZONTAL_GAP = 64;
const VERTICAL_GAP = 88;
const HORIZONTAL_PADDING = 28;
const TOP_PADDING = 28;
const BOTTOM_PADDING = 28;

export function countLeaves(node) {
  if (!node.children || node.children.length === 0) {
    return 1;
  }

  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

export function getTreeNaturalWidth(tree) {
  if (!tree) return 120;
  const leafCount = countLeaves(tree);
  const naturalWidth = leafCount * HORIZONTAL_GAP + HORIZONTAL_PADDING * 2;
  return Math.max(120, naturalWidth);
}

function createLayout(tree) {
  const leafCount = countLeaves(tree);
  // Calculate natural width required for the tree leaves
  const naturalWidth = leafCount * HORIZONTAL_GAP + HORIZONTAL_PADDING * 2;
  const width = Math.max(120, naturalWidth);
  let nextLeaf = 0;
  const nodes = [];
  const edges = [];

  function visit(node, depth) {
    const childPositions = (node.children || []).map((child) => visit(child, depth + 1));
    const x =
      childPositions.length > 0
        ? childPositions.reduce((sum, child) => sum + child.x, 0) / childPositions.length
        : HORIZONTAL_PADDING +
          ((width - HORIZONTAL_PADDING * 2) * (nextLeaf++ + 0.5)) / leafCount;
    const position = {
      id: node.id,
      color: node.targetColor,
      x,
      y: TOP_PADDING + depth * VERTICAL_GAP,
    };

    nodes.push(position);
    childPositions.forEach((child) => {
      edges.push({
        id: `${node.id}-${child.id}`,
        x1: x,
        y1: position.y,
        x2: child.x,
        y2: child.y,
      });
    });

    return position;
  }

  visit(tree, 0);

  const maxDepth = nodes.reduce((depth, node) => Math.max(depth, node.y), 0);
  return {
    width,
    height: maxDepth + BOTTOM_PADDING + NODE_RADIUS,
    nodes,
    edges,
  };
}

export default function TreeRenderer({
  tree,
  onNodePress,
  scale = 1,
  selectedNodeId,
}) {
  const { colors } = useAppTheme();
  const layout = useMemo(
    () => (tree ? createLayout(tree) : null),
    [tree],
  );

  if (!layout) {
    return null;
  }

  const nodeColorMap = {
    red: colors.nodeRed,
    blue: colors.nodeBlue,
  };

  const renderedWidth = layout.width * scale;
  const renderedHeight = layout.height * scale;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={{
            width: renderedWidth,
            height: renderedHeight,
          }}
        >
          <Svg
            width={renderedWidth}
            height={renderedHeight}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            accessibilityLabel="Tree puzzle"
            style={styles.svg}
          >
            {layout.edges.map((edge) => (
              <Line
                key={edge.id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={colors.treeLine}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ))}
            {layout.nodes.map((node) => (
              <Circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS}
                fill={nodeColorMap[node.color] || colors.nodeRed}
                stroke={node.id === selectedNodeId ? colors.ink : colors.nodeBorder}
                strokeWidth={node.id === selectedNodeId ? 4 : 3}
                accessibilityLabel={`${node.id}, ${node.color}`}
              />
            ))}
          </Svg>
          {onNodePress ? (
            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              {layout.nodes.map((node) => (
                <Pressable
                  key={node.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${node.id}, ${node.color}`}
                  onPress={() => onNodePress(node.id)}
                  style={[
                    styles.nodeHitTarget,
                    {
                      left: (node.x - NODE_RADIUS) * scale,
                      top: (node.y - NODE_RADIUS) * scale,
                      width: NODE_RADIUS * 2 * scale,
                      height: NODE_RADIUS * 2 * scale,
                      borderRadius: NODE_RADIUS * scale,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    minWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  nodeHitTarget: {
    position: 'absolute',
  },
});
