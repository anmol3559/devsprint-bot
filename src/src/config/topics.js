// src/config/topics.js

const DSA_TOPICS = [
    // --- Arrays & Hashing ---
    { topic: "Two Sum", difficulty: "Easy", pattern: "Hash Map" },
    { topic: "Valid Anagram", difficulty: "Easy", pattern: "Frequency Counter" },
    { topic: "Contains Duplicate", difficulty: "Easy", pattern: "Hash Set" },
    { topic: "Group Anagrams", difficulty: "Medium", pattern: "Hash Map Sorting" },
    { topic: "Top K Frequent Elements", difficulty: "Medium", pattern: "Min-Heap / Bucket Sort" },
    { topic: "Product of Array Except Self", difficulty: "Medium", pattern: "Prefix & Suffix Products" },
    { topic: "Longest Consecutive Sequence", difficulty: "Medium", pattern: "Hash Set Intelligent Search" },
  
    // --- Two Pointers ---
    { topic: "Valid Palindrome", difficulty: "Easy", pattern: "Two Pointers" },
    { topic: "Two Sum II (Sorted Array)", difficulty: "Medium", pattern: "Two Pointers" },
    { topic: "3Sum", difficulty: "Medium", pattern: "Sorting & Two Pointers" },
    { topic: "Container With Most Water", difficulty: "Medium", pattern: "Two Pointers Greedy" },
    { topic: "Trapping Rain Water", difficulty: "Hard", pattern: "Two Pointers Boundary" },
  
    // --- Sliding Window ---
    { topic: "Best Time to Buy and Sell Stock", difficulty: "Easy", pattern: "Sliding Window" },
    { topic: "Longest Substring Without Repeating Characters", difficulty: "Medium", pattern: "Sliding Window Set" },
    { topic: "Longest Repeating Character Replacement", difficulty: "Medium", pattern: "Dynamic Window" },
    { topic: "Minimum Window Substring", difficulty: "Hard", pattern: "Sliding Window Frequency Match" },
  
    // --- Stack ---
    { topic: "Valid Parentheses", difficulty: "Easy", pattern: "LIFO Stack" },
    { topic: "Min Stack", difficulty: "Medium", pattern: "Auxiliary Min Stack" },
    { topic: "Evaluate Reverse Polish Notation", difficulty: "Medium", pattern: "Stack Arithmetic" },
    { topic: "Daily Temperatures", difficulty: "Medium", pattern: "Monotonic Stack" },
  
    // --- Binary Search ---
    { topic: "Binary Search", difficulty: "Easy", pattern: "Divide and Conquer" },
    { topic: "Search a 2D Matrix", difficulty: "Medium", pattern: "Coordinate Mapping Binary Search" },
    { topic: "Find Minimum in Rotated Sorted Array", difficulty: "Medium", pattern: "Rotated Binary Search" },
    { topic: "Search in Rotated Sorted Array", difficulty: "Medium", pattern: "Modified Binary Search" },
  
    // --- Linked List ---
    { topic: "Reverse Linked List", difficulty: "Easy", pattern: "Pointer Manipulation" },
    { topic: "Merge Two Sorted Lists", difficulty: "Easy", pattern: "Two Pointers" },
    { topic: "Linked List Cycle", difficulty: "Easy", pattern: "Floyd's Tortoise and Hare" },
    { topic: "Reorder List", difficulty: "Medium", pattern: "Fast-Slow Pointer & Reverse" },
    { topic: "Remove Nth Node From End of List", difficulty: "Medium", pattern: "Two Pointers Gap" },
  
    // --- Trees & BST ---
    { topic: "Invert Binary Tree", difficulty: "Easy", pattern: "DFS Recursion" },
    { topic: "Maximum Depth of Binary Tree", difficulty: "Easy", pattern: "Tree DFS" },
    { topic: "Same Tree", difficulty: "Easy", pattern: "Recursive Traversal" },
    { topic: "Subtree of Another Tree", difficulty: "Easy", pattern: "Double DFS" },
    { topic: "Lowest Common Ancestor of a BST", difficulty: "Medium", pattern: "BST Properties" },
    { topic: "Binary Tree Level Order Traversal", difficulty: "Medium", pattern: "BFS Queue" },
    { topic: "Validate Binary Search Tree", difficulty: "Medium", pattern: "DFS with Min-Max Range" },
    { topic: "Kth Smallest Element in a BST", difficulty: "Medium", pattern: "Inorder Traversal" },
  
    // --- Heaps & Priority Queues ---
    { topic: "Kth Largest Element in an Array", difficulty: "Medium", pattern: "Min-Heap" },
    { topic: "Find Median from Data Stream", difficulty: "Hard", pattern: "Two Heaps (Max & Min Heap)" },
  
    // --- Dynamic Programming & Greedy ---
    { topic: "Climbing Stairs", difficulty: "Easy", pattern: "Fibonacci Sequence DP" },
    { topic: "House Robber", difficulty: "Medium", pattern: "Linear DP" },
    { topic: "Coin Change", difficulty: "Medium", pattern: "Unbounded Knapsack DP" },
    { topic: "Longest Increasing Subsequence", difficulty: "Medium", pattern: "1D DP & Binary Search" },
    { topic: "Maximum Subarray (Kadane's Algorithm)", difficulty: "Medium", pattern: "Greedy / DP" }
  ];
  
  module.exports = { TOPICS: DSA_TOPICS };