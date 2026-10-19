import { useEffect, useMemo, useRef, useState } from 'react';
import { getMediaUrl, getValidPropertyMedia, getWrappedMediaIndex } from '../utils/propertyMedia.js';

const PropertyMediaGallery = ({ property }) => {
  const images = useMemo(() => getValidPropertyMedia(property, 'images'), [property]);
  const videos = useMemo(() => getValidPropertyMedia(property, 'videos'), [property]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [failedImages, setFailedImages] = useState({});
  const [failedVideos, setFailedVideos] = useState({});
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    setActiveIndex(0);
    setFailedImages({});
    setFailedVideos({});
  }, [property?._id]);

  useEffect(() => {
    if (!viewerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setViewerOpen(false);
      } else if (event.key === 'ArrowRight' && images.length > 1) {
        setActiveIndex((index) => getWrappedMediaIndex(index, 1, images.length));
      } else if (event.key === 'ArrowLeft' && images.length > 1) {
        setActiveIndex((index) => getWrappedMediaIndex(index, -1, images.length));
      } else if (event.key === 'Tab') {
        const controls = document.querySelectorAll('[data-gallery-control]');
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [viewerOpen, images.length]);

  const openViewer = (index, trigger) => {
    triggerRef.current = trigger;
    setActiveIndex(index);
    setViewerOpen(true);
  };

  const changeImage = (direction) => {
    setActiveIndex((index) => getWrappedMediaIndex(index, direction, images.length));
  };

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45 || images.length < 2) return;
    changeImage(distance < 0 ? 1 : -1);
  };

  const mainImage = images[0];

  return (
    <div className="space-y-7">
      <section aria-label="Property photos">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Property Photos</h2>
        {mainImage && !failedImages[mainImage.sourceIndex] ? (
          <button
            type="button"
            onClick={(event) => openViewer(0, event.currentTarget)}
            className="block w-full overflow-hidden rounded-2xl bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={`View main photo of ${property.title}`}
          >
            <img
              src={getMediaUrl(mainImage.media)}
              alt={`${property.title} - main property photo`}
              className="max-h-[70vh] min-h-56 w-full object-contain"
              onError={() => setFailedImages((current) => ({ ...current, [mainImage.sourceIndex]: true }))}
            />
          </button>
        ) : (
          <div className="flex min-h-56 items-center justify-center rounded-2xl bg-slate-100 px-6 text-center text-sm text-slate-500" role="img" aria-label="Property photo unavailable">
            Property photo is unavailable.
          </div>
        )}
        {images.length > 1 && (
          <div className="mt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Additional Photos</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.slice(1).map(({ media, sourceIndex }, visibleIndex) => {
                const imageIndex = visibleIndex + 1;
                return (
                  <button
                    type="button"
                    key={`property-image-${sourceIndex}`}
                    onClick={(event) => openViewer(imageIndex, event.currentTarget)}
                    className="overflow-hidden rounded-xl bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label={`View photo ${imageIndex + 1} of ${images.length}`}
                  >
                    {failedImages[sourceIndex] ? (
                      <span className="flex aspect-[4/3] items-center justify-center px-2 text-xs text-slate-500">Photo unavailable</span>
                    ) : (
                      <img
                        src={getMediaUrl(media)}
                        alt={`${property.title} - photo ${imageIndex + 1}`}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-contain"
                        onError={() => setFailedImages((current) => ({ ...current, [sourceIndex]: true }))}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {videos.length > 0 && (
        <section aria-labelledby="property-videos-heading">
          <h2 id="property-videos-heading" className="mb-3 text-lg font-semibold text-slate-900">Property Videos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map(({ media, sourceIndex }, index) => {
              const videoUrl = getMediaUrl(media);
              const poster = media && typeof media === 'object' ? getMediaUrl(media.poster || media.thumbnailUrl) : '';
              return (
                <div key={`property-video-${sourceIndex}`} className="overflow-hidden rounded-2xl bg-slate-950">
                  {failedVideos[sourceIndex] ? (
                    <p className="p-5 text-sm text-white" role="alert">This property video could not be played.</p>
                  ) : (
                    <video
                      className="aspect-video w-full bg-black"
                      src={videoUrl}
                      poster={poster || undefined}
                      controls
                      preload="metadata"
                      playsInline
                      aria-label={`${property.title} property video ${index + 1}`}
                      onError={() => setFailedVideos((current) => ({ ...current, [sourceIndex]: true }))}
                    >
                      Your browser does not support embedded video playback.
                    </video>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {viewerOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 p-3 text-white sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Property photo viewer"
          onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
          onTouchEnd={handleTouchEnd}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewerOpen(false);
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-200" aria-live="polite">
              Photo {activeIndex + 1} of {images.length}
            </p>
            <button
              ref={closeButtonRef}
              type="button"
              data-gallery-control
              onClick={() => setViewerOpen(false)}
              className="rounded-full px-4 py-2 text-3xl leading-none hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Close photo viewer"
            >
              ×
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 sm:gap-6">
            {images.length > 1 && (
              <button
                type="button"
                data-gallery-control
                onClick={() => changeImage(-1)}
                className="shrink-0 rounded-full bg-white/10 px-3 py-3 text-xl hover:bg-white/20 sm:px-4"
                aria-label="Previous photo"
              >
                ‹
              </button>
            )}
            {failedImages[images[activeIndex].sourceIndex] ? (
              <div className="flex h-full max-h-[75vh] flex-1 items-center justify-center text-center text-slate-300">
                This property photo is unavailable.
              </div>
            ) : (
              <img
                src={getMediaUrl(images[activeIndex].media)}
                alt={`${property.title} - photo ${activeIndex + 1}`}
                className="max-h-[75vh] min-w-0 max-w-full object-contain"
                onError={() => setFailedImages((current) => ({ ...current, [images[activeIndex].sourceIndex]: true }))}
              />
            )}
            {images.length > 1 && (
              <button
                type="button"
                data-gallery-control
                onClick={() => changeImage(1)}
                className="shrink-0 rounded-full bg-white/10 px-3 py-3 text-xl hover:bg-white/20 sm:px-4"
                aria-label="Next photo"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyMediaGallery;
