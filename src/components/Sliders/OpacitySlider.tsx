import React from 'react';
import { Image, LayoutChangeEvent, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import usePickerContext from '@context';
import Thumb from '@thumb';
import { clamp, getStyle, HSVA2HSLA_string, isRtl, isWeb, RenderNativeOnly, RenderWebOnly } from '@utils';

import type { SliderProps } from '@types';
import type { PanGestureHandlerEventPayload } from 'react-native-gesture-handler';

export function OpacitySlider({
  adaptSpectrum: localAdaptSpectrum,
  thumbShape: localThumbShape,
  thumbSize: localThumbSize,
  thumbColor: localThumbColor,
  boundedThumb: localBoundedThumb,
  renderThumb: localRenderThumb,
  thumbStyle: localThumbStyle,
  thumbInnerStyle: localThumbInnerStyle,
  sliderThickness: localSliderThickness,
  style = {},
  vertical = false,
  reverse = false,
}: SliderProps) {
  const {
    hueValue,
    saturationValue,
    brightnessValue,
    alphaValue,
    onGestureChange,
    onGestureEnd,
    adaptSpectrum: globalAdaptSpectrum,
    thumbSize: globalThumbsSize,
    thumbShape: globalThumbsShape,
    thumbColor: globalThumbsColor,
    boundedThumb: globalBoundedThumb,
    renderThumb: globalRenderThumbs,
    thumbStyle: globalThumbsStyle,
    thumbInnerStyle: globalThumbsInnerStyle,
    sliderThickness: globalSliderThickness,
  } = usePickerContext();

  const thumbShape = localThumbShape ?? globalThumbsShape,
    thumbSize = localThumbSize ?? globalThumbsSize,
    thumbColor = localThumbColor ?? globalThumbsColor,
    boundedThumb = localBoundedThumb ?? globalBoundedThumb,
    renderThumb = localRenderThumb ?? globalRenderThumbs,
    thumbStyle = localThumbStyle ?? globalThumbsStyle ?? {},
    thumbInnerStyle = localThumbInnerStyle ?? globalThumbsInnerStyle ?? {},
    adaptSpectrum = localAdaptSpectrum ?? globalAdaptSpectrum,
    sliderThickness = localSliderThickness ?? globalSliderThickness;

  const borderRadius = getStyle(style, 'borderRadius') ?? 5,
    getWidth = getStyle(style, 'width'),
    getHeight = getStyle(style, 'height');

  const width = useSharedValue(vertical ? sliderThickness : typeof getWidth === 'number' ? getWidth : 0),
    height = useSharedValue(!vertical ? sliderThickness : typeof getHeight === 'number' ? getHeight : 0);

  const handleScale = useSharedValue(1);

  const handleStyle = useAnimatedStyle(() => {
    const length = (vertical ? height.value : width.value) - (boundedThumb ? thumbSize : 0),
      percent = alphaValue.value * length,
      pos = (reverse ? length - percent : percent) - (boundedThumb ? 0 : thumbSize / 2),
      posY = vertical ? pos : height.value / 2 - thumbSize / 2,
      posX = vertical ? width.value / 2 - thumbSize / 2 : pos;
    return {
      transform: [{ translateY: posY }, { translateX: posX }, { scale: handleScale.value }],
    };
  }, [localThumbSize, vertical, reverse]);

  const activeColorStyle = useAnimatedStyle(() => {
    if (!isWeb) return { backgroundColor: '#0000' };

    const deg = vertical ? (reverse ? 1 : 180) : reverse ? 270 : 90;
    const color = HSVA2HSLA_string(
      hueValue.value,
      adaptSpectrum ? saturationValue.value : 100,
      adaptSpectrum ? brightnessValue.value : 100
    );

    return { background: `linear-gradient(${deg}deg, transparent 0%, ${color} 100%)` };
  });

  const onGestureUpdate = ({ x, y }: PanGestureHandlerEventPayload) => {
    'worklet';

    const length = (vertical ? height.value : width.value) - (boundedThumb ? thumbSize : 0),
      posX = clamp((vertical ? y : x) - (boundedThumb ? thumbSize / 2 : 0), length),
      value = posX / length,
      newOpacityValue = reverse ? 1 - value : value;

    if (alphaValue.value === newOpacityValue) return;

    alphaValue.value = newOpacityValue;
    runOnJS(onGestureChange)();
  };
  const onGestureBegin = (event: PanGestureHandlerEventPayload) => {
    'worklet';
    handleScale.value = withTiming(1.2, { duration: 100 });
    onGestureUpdate(event);
  };
  const onGestureFinish = () => {
    'worklet';
    handleScale.value = withTiming(1, { duration: 100 });
    runOnJS(onGestureEnd)();
  };

  const pan = Gesture.Pan().onBegin(onGestureBegin).onUpdate(onGestureUpdate).onEnd(onGestureFinish);
  const tap = Gesture.Tap().onTouchesUp(onGestureFinish);
  const longPress = Gesture.LongPress().onTouchesUp(onGestureFinish);
  const composed = Gesture.Exclusive(pan, tap, longPress);

  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (!vertical) width.value = withTiming(layout.width, { duration: 5 });
    if (vertical) height.value = withTiming(layout.height, { duration: 5 });
  };

  const imageStyle = useAnimatedStyle(() => {
    if (isWeb) return {};

    const imageRotate = vertical ? (reverse ? '90deg' : '270deg') : reverse ? '0deg' : '180deg';
    const imageTranslateY = ((height.value - width.value) / 2) * ((reverse && isRtl) || (!reverse && !isRtl) ? -1 : 1);
    return {
      width: vertical ? height.value : '100%',
      height: vertical ? width.value : '100%',
      tintColor: HSVA2HSLA_string(
        hueValue.value,
        adaptSpectrum ? saturationValue.value : 100,
        adaptSpectrum ? brightnessValue.value : 100
      ),
      borderRadius,
      transform: [
        { rotate: imageRotate },
        { translateX: vertical ? ((height.value - width.value) / 2) * (reverse ? 1 : -1) : 0 },
        { translateY: vertical ? imageTranslateY : 0 },
      ],
    };
  }, [vertical, reverse, sliderThickness]);

  const thicknessStyle = vertical ? { width: sliderThickness } : { height: sliderThickness };

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        onLayout={onLayout}
        style={[
          { borderRadius },
          style,
          { position: 'relative', borderWidth: 0, padding: 0 },
          thicknessStyle,
          isWeb ? webTransparentTexture : {},
        ]}
      >
        <RenderNativeOnly>
          <Image
            source={require('@assets/transparent-texture.png')}
            style={[{ width: '100%', height: '100%', borderRadius }, StyleSheet.absoluteFill]}
            resizeMode='repeat'
          />
          <Animated.Image source={require('@assets/blackGradient.png')} style={imageStyle} resizeMode='stretch' />
        </RenderNativeOnly>

        <RenderWebOnly>
          <Animated.View style={[{ flex: 1, borderRadius }, activeColorStyle]} />
        </RenderWebOnly>

        <Thumb
          {...{
            channel: 'a',
            thumbShape,
            thumbSize,
            thumbColor,
            renderThumb,
            handleStyle,
            innerStyle: thumbInnerStyle,
            style: thumbStyle,
            vertical,
            adaptSpectrum,
          }}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const webTransparentTexture = {
  flex: undefined,
  backgroundImage:
    'repeating-linear-gradient(45deg, #c1c1c1 25%, transparent 25%, transparent 75%, #c1c1c1 75%, #c1c1c1), repeating-linear-gradient(45deg, #c1c1c1 25%, #fff 25%, #fff 75%, #c1c1c1 75%, #c1c1c1)',
  backgroundPosition: '0px 0px, 8px 8px',
  backgroundSize: '16px 16px',
};
