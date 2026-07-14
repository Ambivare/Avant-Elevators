<template>
  <img src="/AI.png" :style="`width:${size}px;height:${size}px;object-fit:contain;display:block;`" alt="AI" />
</template>

<script setup>
defineProps({ size: { type: Number, default: 17 } })
</script>
